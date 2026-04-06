require('dotenv').config()
const { Pool } = require('pg')

let connectionString = process.env.DATABASE_URL || ''

/**
 * Supabase Transaction pooler (port 6543) expects pgbouncer=true on the URI.
 * Without it, node-pg can fail against PgBouncer in transaction mode.
 */
function normalizeSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return url
  let out = url.trim()
  const isPooler =
    out.includes('pooler.supabase.com') || out.includes(':6543')
  if (isPooler && !out.includes('pgbouncer=true')) {
    out += out.includes('?') ? '&' : '?'
    out += 'pgbouncer=true'
  }
  return out
}

connectionString = normalizeSupabaseUrl(connectionString)

if (!connectionString) {
  console.warn('Warning: DATABASE_URL is not set.')
}

function sslOption() {
  if (process.env.DATABASE_SSL === 'false') {
    return false
  }
  const url = connectionString || ''
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('::1')

  if (isLocal) {
    return false
  }

  // Supabase / managed Postgres: TLS required; many hosts use certs that need this in Node
  const isSupabase =
    url.includes('supabase.co') ||
    url.includes('pooler.supabase.com')

  if (process.env.DATABASE_SSL === 'true' || process.env.PGSSLMODE === 'require') {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    }
  }

  if (isSupabase) {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    }
  }

  if (url.includes('sslmode=require')) {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    }
  }

  if (url.startsWith('postgres')) {
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    }
  }

  return false
}

const pool = new Pool({
  connectionString,
  ssl: sslOption(),
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 25_000,
})

module.exports = pool
