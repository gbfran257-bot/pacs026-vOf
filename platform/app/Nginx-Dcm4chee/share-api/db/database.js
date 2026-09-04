const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pacsdb',
  user: process.env.DB_USER || 'pacs',
  password: process.env.DB_PASS || 'pacs',
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
