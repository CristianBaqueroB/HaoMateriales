const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false // Requerido para Neon
  }
});

// Verificación inicial de conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error conectando a la DB:', err.stack);
  } else {
    console.log('✅ Conexión a PostgreSQL (Neon) exitosa');
  }
});

module.exports = pool;