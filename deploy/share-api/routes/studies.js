const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  imageToDicomBuffer,
  isDicomBuffer,
  overrideDicomFields,
  readDicomMetadataPreview,
} = require('../dicomUtils');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const DCM4CHEE_URL = process.env.DCM4CHEE_URL || 'http://arc:8080';
const AET = process.env.DCM4CHEE_AET || 'DCM4CHEE';
const STOW_URL = `${DCM4CHEE_URL}/dcm4chee-arc/aets/${AET}/rs/studies`;

const JUNK_FILENAMES = ['.ds_store', 'thumbs.db', 'desktop.ini', '.localized'];

function esArchivoBasura(nombre) {
  const lower = nombre.toLowerCase();
  return JUNK_FILENAMES.includes(lower) || lower.startsWith('._'); // archivos de recurso de macOS
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
    throw new Error(`STOW-RS falló (${response.status}): ${text}`);
  }
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* algunas respuestas vienen vacías en éxito total */ }
  return json;
}

// Extrae el StudyInstanceUID real donde quedó guardado un archivo, leyendo
// el RetrieveURL que dcm4chee-arc devuelve en la respuesta de STOW-RS.
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

// POST /api/studies/upload (una sola imagen — se mantiene por compatibilidad)
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { patientName, patientId, descripcion } = req.body;
  if (!req.file || !patientName || !patientId) {
    return res.status(400).json({ error: 'Faltan archivo, nombre o ID del paciente' });
  }
  try {
    const existingStudyUID = await findExistingStudyForPatient(req.user.id, patientId);
    const studyInstanceUID = existingStudyUID || newUid();
    const seriesInstanceUID = newUid();
    const sopInstanceUID = newUid();

    const dicomBuffer = await imageToDicomBuffer({
      imageBuffer: req.file.buffer,
      patientName, patientId,
      studyDescription: descripcion || '',
      modality: 'OT',
      studyInstanceUID, seriesInstanceUID, sopInstanceUID,
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
router.post('/upload-batch', requireAuth, upload.array('files', 200), async (req, res) => {
  const { patientName, patientId, descripcion } = req.body;
  if (!req.files || req.files.length === 0 || !patientName || !patientId) {
    return res.status(400).json({ error: 'Faltan archivos, nombre o ID del paciente' });
  }

  const archivosUtiles = req.files.filter((f) => !esArchivoBasura(f.originalname) && f.size > 1024);
  const ignorados = req.files.length - archivosUtiles.length;

  if (archivosUtiles.length === 0) {
    return res.status(400).json({ error: 'No había ningún archivo válido (solo archivos de sistema)' });
  }

  const existingStudyUID = await findExistingStudyForPatient(req.user.id, patientId);
  const studyInstanceUID = existingStudyUID || newUid();
  const seriesInstanceUID = newUid();

  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];
  const resultados = [];      // { archivo, studyInstanceUID, modo }
  const errores = [];
  const studiosAjenos = new Set(); // estudios "crudos" que no se pudieron fusionar

  for (const file of archivosUtiles) {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    try {
      if (IMAGE_EXTS.includes(ext)) {
        // Imagen normal (PNG/JPG) → se construye desde cero, segura de reescribir
        const sopInstanceUID = newUid();
        const dicomBuffer = await imageToDicomBuffer({
          imageBuffer: file.buffer, patientName, patientId,
          studyDescription: descripcion || '', modality: 'OT',
          studyInstanceUID, seriesInstanceUID, sopInstanceUID,
        });
        await stowDicom(dicomBuffer);
        resultados.push({ archivo: file.originalname, studyInstanceUID, modo: 'convertido' });

      } else {
        // DICOM real (de equipo médico) → NUNCA se reescribe, se sube intacto.
        // Reescribir con dcmjs puede corromper archivos con pixel data comprimido.
        // Conserva SU PROPIO paciente/estudio grabado por el equipo de origen.
        const stowResponse = await stowDicom(file.buffer);
        const uidReal = extractStudyUidFromStowResponse(stowResponse) || studyInstanceUID;
        if (uidReal !== studyInstanceUID) studiosAjenos.add(uidReal);
        resultados.push({ archivo: file.originalname, studyInstanceUID: uidReal, modo: 'original (conserva su propio paciente)' });
      }
    } catch (err) {
      console.error(`Error con ${file.originalname}:`, err.message);
      errores.push({ archivo: file.originalname, error: err.message });
    }
  }

  if (resultados.length === 0) {
    return res.status(502).json({ error: 'Ningún archivo pudo subirse', errores, ignorados });
  }

  const todosLosEstudios = [studyInstanceUID, ...studiosAjenos];
  for (const uid of todosLosEstudios) {
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
