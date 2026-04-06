require('dotenv').config()
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.warn('Warning: DATABASE_URL is not set.')
}

/**
 * Supabase / cloud Postgres need SSL. Local Postgres usually does not.
 * Supabase URI often includes sslmode=require; we still set ssl for the driver.
 */
function sslOption() {
  if (process.env.DATABASE_SSL === 'false') {
    return false
  }
  if (process.env.DATABASE_SSL === 'true' || process.env.PGSSLMODE === 'require') {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    }
  }
  const url = connectionString || ''
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('::1')
  if (isLocal) {
    return false
  }
  if (
    url.includes('supabase.co') ||
    url.includes('pooler.supabase.com') ||
    url.includes('sslmode=require')
  ) {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    }
  }
  // Any other remote host: use TLS
  if (url.startsWith('postgres')) {
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
  connectionTimeoutMillis: 15_000,
  ssl: sslOption(),
})
