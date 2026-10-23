const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth, readCookie, JWT_SECRET, COOKIE_NAME, COOKIE_OPTIONS } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nombre: user.nombre, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// POST /api/portal-auth/register
router.post('/register', async (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const existing = await pool.query('SELECT id FROM app.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ese email ya está registrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO app.users (nombre, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, nombre, email, role`,
      [nombre, email, hash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// POST /api/portal-auth/login
router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email o contraseña' });
  }
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, role, password_hash FROM app.users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// GET /api/portal-auth/me  -- valida la sesión y repone la cookie si faltaba
router.get('/me', requireAuth, async (req, res) => {
  try {
    const u = await pool.query('SELECT id, nombre, email, role FROM app.users WHERE id = $1', [req.user.id]);
    if (u.rows.length === 0) return res.status(401).json({ error: 'Usuario no existe' });
    if (!readCookie(req, COOKIE_NAME)) {
      res.cookie(COOKIE_NAME, signToken(u.rows[0]), COOKIE_OPTIONS);
    }
    res.json({ user: u.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al validar sesión' });
  }
});

// POST /api/portal-auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// GET /api/portal-auth/can-write  -- lo consulta nginx (auth_request)
// 204 = puede escribir, 401/403 = no
router.get('/can-write', async (req, res) => {
  try {
    const token = readCookie(req, COOKIE_NAME);
    if (!token) return res.sendStatus(401);

    const payload = jwt.verify(token, JWT_SECRET);

    // El rol se lee de la BD en cada llamada: un usuario borrado o degradado pierde acceso al instante
    const u = await pool.query('SELECT id, role FROM app.users WHERE id = $1', [payload.id]);
    if (u.rows.length === 0) return res.sendStatus(401);
    const { id, role } = u.rows[0];

    if (role === 'admin') return res.sendStatus(204);

    // Estudios abiertos en el visor, tomados del Referer
    let uids = [];
    try {
      const q = new URL(req.headers['x-original-referer'] || '').searchParams.get('StudyInstanceUIDs') || '';
      uids = q.split(',').filter(Boolean);
    } catch (_) {}
    if (uids.length === 0) return res.sendStatus(403);

    const r = await pool.query(
      'SELECT study_iuid FROM app.user_studies WHERE user_id = $1 AND study_iuid = ANY($2)',
      [id, uids]
    );
    return r.rows.length === uids.length ? res.sendStatus(204) : res.sendStatus(403);
  } catch (err) {
    return res.sendStatus(401);
  }
});

module.exports = router;
