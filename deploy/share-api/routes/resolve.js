const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { rows } = await db.query(
      `SELECT * FROM shared_links WHERE token = $1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Token no válido'
      });
    }

    const link = rows[0];

    // Verificar expiración (si aplica)
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        expired: true,
        message: 'El enlace ha expirado'
      });
    }

    // Auditoría
    await db.query(
      `UPDATE shared_links
       SET accessed_count = accessed_count + 1,
           last_accessed = NOW()
       WHERE token = $1`,
      [token]
    );

    // 🔑 RESPUESTA CORRECTA
    res.json({
      success: true,
      studyUID: link.study_uid,
      viewerUrl: process.env.OHIF_URL || '/'
    });

  } catch (err) {
    console.error('Error en resolve:', err);
    res.status(500).json({
      success: false,
      message: 'Error interno'
    });
  }
});

module.exports = router;

