Auth · JS
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();

// Usa las mismas variables de entorno que ya tienes en docker-compose.env
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pacsdb',
  user: process.env.DB_USER || 'pacs',
  password: process.env.DB_PASS || 'pacs',
});

// IMPORTANTE: define esto en el environment de share-api en docker-compose.yml
// JWT_SECRET=alguna-cadena-larga-y-secreta
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[auth.js] FALTA la variable de entorno JWT_SECRET. El login no va a funcionar.');
}

// POST /api/auth/login  { username, password }
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Faltan credenciales' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // pon true si sirves por https
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error('[auth.js] Error en /auth/login:', err);
    return res.sendStatus(500);
  }
});

// GET /api/auth/validate  -- usado por nginx auth_request
router.get('/auth/validate', (req, res) => {
  try {
    const token = req.cookies?.session_token;
    if (!token) {
      return res.sendStatus(401);
    }
    jwt.verify(token, JWT_SECRET);
    return res.sendStatus(200);
  } catch (err) {
    return res.sendStatus(401);
  }
});

// POST /api/auth/logout
router.post('/auth/logout', (req, res) => {
  res.clearCookie('session_token');
  return res.sendStatus(200);
});

module.exports = router;
