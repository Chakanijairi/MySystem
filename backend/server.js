require('dotenv').config()
const crypto = require('crypto')

function requireEnv(name, hint) {
  const v = process.env[name]
  if (!v || !String(v).trim()) {
    console.error(`Missing ${name}.`)
    console.error(hint)
    process.exit(1)
  }
  return v
}

// Render often has no .env file — JWT_SECRET must be set in the dashboard for stable sessions.
// If you forgot, we generate one so the process still starts (logins reset on every deploy / new instance).
if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
  console.warn(
    '[dealer-monitoring] JWT_SECRET was not set. Using a random secret for this run. Add JWT_SECRET in Render → Environment for stable logins across restarts and when scaling beyond one instance.'
  )
}

requireEnv(
  'DATABASE_URL',
  'Set DATABASE_URL to your Supabase connection string (Settings → Database → URI).'
)

const express = require('express')
const cors = require('cors')
const pool = require('./db/pool')

const app = express()
const port = Number(process.env.PORT) || 5000

/** https:// + host, no trailing slash */
function normalizeOriginEntry(entry) {
  let s = String(entry || '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  return s.replace(/\/$/, '')
}

const originRaw =
  process.env.FRONTEND_ORIGIN ||
  process.env.FRONTEND_URLS ||
  'http://localhost:5173'
const allowedOrigins = originRaw
  .split(',')
  .map(normalizeOriginEntry)
  .filter(Boolean)

/** Preview / production on Vercel (*.vercel.app). Set CORS_ALLOW_VERCEL=false to disable. */
const vercelHttps = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i

function isOriginAllowed(origin) {
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true
  if (process.env.CORS_ALLOW_VERCEL !== 'false' && vercelHttps.test(origin)) {
    return true
  }
  return false
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, true)
      }
      console.warn('[cors] Blocked origin:', origin, '| allowed list:', allowedOrigins)
      return callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
)
app.use(express.json({ limit: '2mb' }))

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'dealer-monitoring-api', docs: '/api/health' })
})

app.use('/api/auth', require('./routes/auth'))
app.use('/api/me', require('./routes/me'))
app.use('/api/admin', require('./routes/admin'))

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, service: 'dealer-monitoring-api', database: 'connected' })
  } catch (err) {
    res.status(503).json({
      ok: false,
      service: 'dealer-monitoring-api',
      database: 'disconnected',
      error: err.message,
    })
  }
})

app.use((err, _req, res, next) => {
  if (err && err.name === 'MulterError') {
    return res.status(400).json({ error: err.message || 'Upload error' })
  }
  if (err && err.message && err.message.includes('allowed')) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`)
  pool
    .query('SELECT current_database() AS db')
    .then(({ rows }) => {
      console.log(`PostgreSQL: connected (database: ${rows[0].db})`)
    })
    .catch((err) => {
      console.error('PostgreSQL connection failed. Check DATABASE_URL (Supabase URI + SSL).')
      console.error(err.message)
      console.error(
        'The API is still running — /api/health will report database status. Login needs a working database.'
      )
    })
})
