require('dotenv').config()

function requireEnv(name, hint) {
  const v = process.env[name]
  if (!v || !String(v).trim()) {
    console.error(`Missing ${name}.`)
    console.error(hint)
    process.exit(1)
  }
  return v
}

// Render / Railway / Fly inject env in the dashboard — there is no .env file on the server.
requireEnv(
  'JWT_SECRET',
  'Set JWT_SECRET in your host (e.g. Render → Environment): a long random string (32+ chars).'
)
requireEnv(
  'DATABASE_URL',
  'Set DATABASE_URL to your Supabase connection string (Settings → Database → URI).'
)

const express = require('express')
const cors = require('cors')
const pool = require('./db/pool')

const app = express()
const port = Number(process.env.PORT) || 5000

/** Comma-separated: Vercel URL + localhost for dev */
const originRaw =
  process.env.FRONTEND_ORIGIN ||
  process.env.FRONTEND_URLS ||
  'http://localhost:5173'
const allowedOrigins = originRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
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
