const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      studyUID,
      patientName,
      patientID,
      studyDate,
      modality,
      expiryHours
    } = req.body;

    if (!studyUID) {
      return res.status(400).json({
        success: false,
        message: 'studyUID es requerido'
      });
    }

        // 🔎 VERIFICAR SI YA EXISTE TOKEN ACTIVO
    const existing = await db.query(
      `SELECT token, expires_at
       FROM shared_links
       WHERE study_uid = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [studyUID]
    );

        if (existing.rows.length > 0) {
      return res.json({
        success: true,
        reused: true,
        token: existing.rows[0].token,
        url: `${process.env.OHIF_URL}/token-resolver.html?token=${existing.rows[0].token}`,
        expiresAt: existing.rows[0].expires_at
      });
    }
//
    const token = uuidv4().replace(/-/g, '');

    let expiresAt = null;

    if (Number.isInteger(expiryHours) && expiryHours > 0) {
      expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);
    }

    await db.query(
      `INSERT INTO shared_links
       (token, study_uid, patient_name, patient_id, study_date, modality, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        token,
        studyUID,
        patientName || null,
        patientID || null,
        studyDate || null,
        modality || null,
        expiresAt
      ]
    );

    const baseUrl = process.env.OHIF_URL;
    const url = `${baseUrl}/token-resolver.html?token=${token}`;

    res.json({
      success: true,
      reused: false, //
      token,
      url,
      expiresAt
    });

  } catch (err) {
    console.error('SHARE ERROR:', err);
    res.status(500).json({
      success: false,
      message: 'Error al generar enlace'
    });
  }
});

module.exports = router;
