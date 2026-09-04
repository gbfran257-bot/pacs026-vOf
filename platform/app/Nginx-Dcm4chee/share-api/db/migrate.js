const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Datos para conectar a PostgreSQL
const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

async function runMigrations() {
  await client.connect();

  // Crear tabla migrations si no existe
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✔ Tabla 'migrations' lista");

  // Leer migraciones
  const migrationDir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(migrationDir).filter(f => f.endsWith(".sql")).sort();

  for (let file of files) {
    const check = await client.query(
      "SELECT 1 FROM migrations WHERE name = $1 LIMIT 1",
      [file]
    );

    if (check.rows.length > 0) {
      console.log(`↪ Saltando (ya aplicada): ${file}`);
      continue;
    }

    console.log(`▶ Ejecutando migración: ${file}`);

    const sql = fs.readFileSync(path.join(migrationDir, file), "utf-8");
    await client.query(sql);

    await client.query(
      "INSERT INTO migrations (name) VALUES ($1)",
      [file]
    );

    console.log(`✔ Migración aplicada: ${file}`);
  }

  await client.end();
}

runMigrations().catch(err => {
  console.error("❌ Error en migraciones:", err);
  process.exit(1);
});
