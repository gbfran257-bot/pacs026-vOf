// share-api/routes/share.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const router = express.Router();

router.post('/share', async (req, res) => {
  try {
    const {
      studyUID,
      seriesUID,
      patientName,
      patientID,
      studyDate,
      modality,
      accessionNumber,
      description,
      expiryHours = 48,
      maxUses = null,
      viewerUrl = null,
      createdBy = null
    } = req.body;

    if (!studyUID) {
      return res.status(400).json({ success: false, message: 'studyUID es requerido' });
    }

    const token = uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000));

    const insertQuery = `
      INSERT INTO shared_links
      (token, study_uid, series_uid, modality, accession_number, patient_name, patient_id, study_date, description, expires_at, max_uses, viewer_url, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, token, created_at, expires_at
    `;

    const values = [
      token,
      studyUID,
      seriesUID || null,
      modality || null,
      accessionNumber || null,
      patientName || null,
      patientID || null,
      studyDate || null,
      description || null,
      expiresAt,
      maxUses,
      viewerUrl,
      createdBy
    ];

    const result = await db.query(insertQuery, values);
    const row = result.rows[0];

    const baseUrl = process.env.OHIF_URL || 'http://localhost';
    const shareUrl = `${baseUrl.replace(/\/$/, '')}/token-resolver.html?token=${token}`;

    res.json({
      success: true,
      token,
      url: shareUrl,
      expiresAt: row.expires_at,
      studyUID
    });

  } catch (error) {
    console.error('Error generating share link:', error);
    res.status(500).json({ success: false, message: 'Error al generar enlace', error: error.message });
  }
});

module.exports = router;
