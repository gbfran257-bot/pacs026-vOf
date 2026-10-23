const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  imageToDicomBuffer,
  readStudyUid,
  readDicomMetadataPreview,
} = require('../dicomUtils');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const DCM4CHEE_URL = process.env.DCM4CHEE_URL || 'http://dcm4chee-arc:8080';
const AET = process.env.DCM4CHEE_AET || 'DCM4CHEE';
const STOW_URL = `${DCM4CHEE_URL}/dcm4chee-arc/aets/${AET}/rs/studies`;

const JUNK_FILENAMES = ['.ds_store', 'thumbs.db', 'desktop.ini', '.localized'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];

function esArchivoBasura(nombre) {
  const lower = nombre.toLowerCase();
  return JUNK_FILENAMES.includes(lower) || lower.startsWith('._'); // recursos de macOS
}

function newUid() {
  return `2.25.${BigInt('0x' + uuidv4().replace(/-/g, ''))}`;
}

async function stowDicom(dicomBuffer) {
  const boundary = `----pacsportal${Date.now()}${Math.random().toString(16).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`),
    dicomBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch(STOW_URL, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
      'Accept': 'application/dicom+json',
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`STOW-RS falló (${response.status}): ${text.slice(0, 300)}`);
  }
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* respuesta vacía en éxito total */ }
  return json;
}

// StudyInstanceUID real donde quedó guardado un archivo (RetrieveURL de la respuesta STOW-RS)
function extractStudyUidFromStowResponse(json) {
  try {
    const refSeq = json && json['00081199'] && json['00081199'].Value;
    if (!refSeq || !refSeq.length) return null;
    const retrieveURL = refSeq[0]['00081190'] && refSeq[0]['00081190'].Value && refSeq[0]['00081190'].Value[0];
    if (!retrieveURL) return null;
    const match = retrieveURL.match(/studies\/([^/]+)\//);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

async function findExistingStudyForPatient(userId, patientId) {
  const result = await pool.query(
    `SELECT s.study_iuid
     FROM app.user_studies us
     JOIN study s ON s.study_iuid = us.study_iuid
     JOIN patient p ON s.patient_fk = p.pk
     JOIN patient_id pid ON p.patient_id_fk = pid.pk
     WHERE us.user_id = $1 AND pid.pat_id = $2
     ORDER BY s.study_date DESC
     LIMIT 1`,
    [userId, patientId]
  );
  return result.rows.length ? result.rows[0].study_iuid : null;
}

// Evita "secuestrar" estudios: si el estudio ya existe en el PACS y no es del usuario, se rechaza
async function assertStudyNotForeign(userId, studyUid) {
  if (!studyUid) return;
  const r = await pool.query(
    `SELECT us.user_id
     FROM study s
     LEFT JOIN app.user_studies us ON us.study_iuid = s.study_iuid
     WHERE s.study_iuid = $1
     LIMIT 1`,
    [studyUid]
  );
  if (r.rows.length === 0) return;                 // estudio nuevo: ok
  if (r.rows[0].user_id === userId) return;        // ya es suyo: ok
  throw new Error('Ese estudio ya existe en el PACS y no te pertenece');
}

// GET /api/studies/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         pn.alphabetic_name AS patient_name,
         pid.pat_id AS patient_id,
         s.study_iuid,
         s.study_date,
         s.study_desc,
         (SELECT string_agg(DISTINCT se.modality, ',') FROM series se WHERE se.study_fk = s.pk) AS modalities_in_study
       FROM app.user_studies us
       JOIN study s ON s.study_iuid = us.study_iuid
       JOIN patient p ON s.patient_fk = p.pk
       JOIN patient_id pid ON p.patient_id_fk = pid.pk
       JOIN person_name pn ON p.pat_name_fk = pn.pk
       WHERE us.user_id = $1
       ORDER BY s.study_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los estudios' });
  }
});

// POST /api/studies/upload (una sola imagen, por compatibilidad)
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { patientName, patientId, descripcion } = req.body;
  if (!req.file || !patientName || !patientId) {
    return res.status(400).json({ error: 'Faltan archivo, nombre o ID del paciente' });
  }
  try {
    const existingStudyUID = await findExistingStudyForPatient(req.user.id, patientId);
    const studyInstanceUID = existingStudyUID || newUid();

    const dicomBuffer = await imageToDicomBuffer({
      imageBuffer: req.file.buffer,
      patientName, patientId,
      studyDescription: descripcion || '',
      modality: 'OT',
      studyInstanceUID,
      seriesInstanceUID: newUid(),
      sopInstanceUID: newUid(),
    });

    await stowDicom(dicomBuffer);

    await pool.query(
      'INSERT INTO app.user_studies (user_id, study_iuid) VALUES ($1, $2) ON CONFLICT (study_iuid) DO NOTHING',
      [req.user.id, studyInstanceUID]
    );

    res.status(201).json({ studyInstanceUID, reutilizado: !!existingStudyUID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar o subir la imagen' });
  }
});

// POST /api/studies/upload-batch (varios archivos / carpeta)
router.post('/upload-batch', requireAuth, (req, res, next) => {
  upload.array('files', 200)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const patientName = (req.body.patientName || '').trim();
  const patientId = (req.body.patientId || '').trim();
  const descripcion = (req.body.descripcion || '').trim();

  if (!req.files || req.files.length === 0 || !patientName || !patientId) {
    return res.status(400).json({ error: 'Faltan archivos, nombre o ID del paciente' });
  }

  const archivosUtiles = req.files.filter((f) => !esArchivoBasura(f.originalname) && f.size > 1024);
  const ignorados = req.files.length - archivosUtiles.length;

  if (archivosUtiles.length === 0) {
    return res.status(400).json({ error: 'No había ningún archivo válido (solo archivos de sistema)' });
  }

  try {
    const existingStudyUID = await findExistingStudyForPatient(req.user.id, patientId);
    const studyInstanceUID = existingStudyUID || newUid();
    const seriesInstanceUID = newUid();

    const resultados = [];
    const errores = [];
    const studiosAjenos = new Set(); // estudios "crudos" que no se fusionaron con el principal

    for (const file of archivosUtiles) {
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      try {
        if (IMAGE_EXTS.includes(ext)) {
          const dicomBuffer = await imageToDicomBuffer({
            imageBuffer: file.buffer, patientName, patientId,
            studyDescription: descripcion, modality: 'OT',
            studyInstanceUID, seriesInstanceUID, sopInstanceUID: newUid(),
          });
          await stowDicom(dicomBuffer);
          resultados.push({ archivo: file.originalname, studyInstanceUID, modo: 'convertido' });
        } else {
          // DICOM real: se sube intacto (reescribirlo puede corromper pixel data comprimido)
          await assertStudyNotForeign(req.user.id, readStudyUid(file.buffer));

          const stowResponse = await stowDicom(file.buffer);
          const uidReal = extractStudyUidFromStowResponse(stowResponse) || studyInstanceUID;

          // Revalida con el UID que devolvió el PACS (por si el archivo no traía UID legible)
          if (uidReal !== studyInstanceUID) {
            await assertStudyNotForeign(req.user.id, uidReal);
            studiosAjenos.add(uidReal);
          }
          resultados.push({ archivo: file.originalname, studyInstanceUID: uidReal, modo: 'original' });
        }
      } catch (err) {
        console.error(`Error con ${file.originalname}:`, err.message);
        errores.push({ archivo: file.originalname, error: err.message });
      }
    }

    if (resultados.length === 0) {
      return res.status(502).json({ error: 'Ningún archivo pudo subirse', errores, ignorados });
    }

    const uids = new Set(resultados.map((r) => r.studyInstanceUID));
    for (const uid of uids) {
      await pool.query(
        'INSERT INTO app.user_studies (user_id, study_iuid) VALUES ($1, $2) ON CONFLICT (study_iuid) DO NOTHING',
        [req.user.id, uid]
      );
    }

    res.status(201).json({
      studyInstanceUID,
      reutilizado: !!existingStudyUID,
      subidos: resultados,
      errores,
      ignorados,
      estudiosAjenos: Array.from(studiosAjenos),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la subida' });
  }
});

// POST /api/studies/preview-dicom
router.post('/preview-dicom', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
  try {
    res.json(readDicomMetadataPreview(req.file.buffer));
  } catch (err) {
    res.status(400).json({ error: 'No se pudo leer el DICOM', detalle: err.message });
  }
});

module.exports = router;
