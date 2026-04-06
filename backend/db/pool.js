require('dotenv').config()
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.warn('Warning: DATABASE_URL is not set.')
}

/** SSL for cloud hosts (Neon, Supabase, RDS, etc.). Local Postgres: leave unset. */
function sslOption() {
  if (process.env.DATABASE_SSL === 'true' || process.env.PGSSLMODE === 'require') {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    }
  }
  return false
}

module.exports = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: sslOption(),
})
