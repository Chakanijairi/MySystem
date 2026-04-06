require('dotenv').config()

if (!process.env.JWT_SECRET) {
  console.error('Set JWT_SECRET in backend/.env')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in backend/.env')
  process.exit(1)
}

const express = require('express')
const cors = require('cors')
const pool = require('./db/pool')

const app = express()
const port = Number(process.env.PORT) || 5000
const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin, credentials: true }))
app.use(express.json({ limit: '2mb' }))

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

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
  pool
    .query('SELECT current_database() AS db')
    .then(({ rows }) => {
      console.log(`PostgreSQL: connected (database: ${rows[0].db})`)
    })
    .catch((err) => {
      console.error('PostgreSQL connection failed. Fix DATABASE_URL in backend/.env')
      console.error(err.message)
      console.error(
        'The API is still running — /api/health will report database status. Login needs a working database.'
      )
    })
})
