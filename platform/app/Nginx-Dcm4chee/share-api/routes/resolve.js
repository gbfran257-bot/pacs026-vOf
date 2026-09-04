// share-api/routes/resolve.js
const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/resolve/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT id, study_uid, patient_name, patient_id, study_date, modality, expires_at, max_uses, is_active
       FROM shared_links
       WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Token invalido o no encontrado' });
    }

    const link = result.rows[0];

    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (!link.is_active) {
      await db.query(
        `INSERT INTO shared_links_access_log(link_id, ip_address, user_agent, status) VALUES ($1,$2,$3,$4)`,
        [link.id, req.ip || null, req.get('User-Agent') || null, 'inactive']
      );
      return res.status(403).json({ success: false, message: 'Enlace desactivado' });
    }

    if (expiresAt < now) {
      await db.query(
        `INSERT INTO shared_links_access_log(link_id, ip_address, user_agent, status) VALUES ($1,$2,$3,$4)`,
        [link.id, req.ip || null, req.get('User-Agent') || null, 'expired']
      );
      return res.status(410).json({ success: false, message: 'Token expirado' });
    }

    // decrementar max_uses si aplica
    if (link.max_uses !== null) {
      await db.query(
        `UPDATE shared_links SET max_uses = max_uses - 1 WHERE id = $1 AND (max_uses > 0 OR max_uses IS NULL)`,
        [link.id]
      );
    }

    // actualizar contador y last_accessed
    await db.query(
      `UPDATE shared_links
       SET accessed_count = COALESCE(accessed_count,0) + 1, last_accessed = NOW()
       WHERE id = $1`,
      [link.id]
    );

    await db.query(
      `INSERT INTO shared_links_access_log(link_id, ip_address, user_agent, status) VALUES ($1,$2,$3,$4)`,
      [link.id, req.ip || null, req.get('User-Agent') || null, 'success']
    );

    res.json({
      success: true,
      studyUID: link.study_uid,
      patientName: link.patient_name,
      patientID: link.patient_id,
      studyDate: link.study_date,
      modality: link.modality,
      expiresAt: link.expires_at,
      viewerUrl: process.env.OHIF_URL || "http://localhost"
    });

  } catch (error) {
    console.error('Error resolving token:', error);
    res.status(500).json({ success: false, message: 'Error al validar token', error: error.message });
  }
});

router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT token, expires_at FROM shared_links WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false, reason: 'not_found' });
    }

    const link = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (expiresAt < now) {
      return res.json({ valid: false, reason: 'expired', expiresAt: link.expires_at });
    }

    res.json({ valid: true, expiresAt: link.expires_at });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ valid: false, reason: 'error' });
  }
});

module.exports = router;
