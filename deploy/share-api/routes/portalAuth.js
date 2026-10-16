const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/portal-auth/register
router.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
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
      'INSERT INTO app.users (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre, email',
      [nombre, email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, nombre: user.nombre }, JWT_SECRET, { expiresIn: '12h' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// POST /api/portal-auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email o contraseña' });
  }
  try {
    const result = await pool.query('SELECT id, nombre, email, password_hash FROM app.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, nombre: user.nombre }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;
