const express = require('express')
const pool = require('../db/pool')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate, requireAdmin)

const ALLOWED_PREFIX = /^(identity|pref)\./
const KEY_RE = /^[a-zA-Z0-9_.-]{1,128}$/
const MAX_VALUE_BYTES = 5 * 1024 * 1024 // 5 MB cap so a logo data URL still fits

function isAllowedKey(k) {
  return typeof k === 'string' && KEY_RE.test(k) && ALLOWED_PREFIX.test(k)
}

router.get('/settings', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM system_settings ORDER BY key ASC`
    )
    const out = {}
    for (const r of rows) {
      out[r.key] = r.value
    }
    return res.json({ settings: out })
  } catch (err) {
    console.error('[GET /admin/settings]', err)
    return res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.patch('/settings', async (req, res) => {
  const client = await pool.connect()
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const entries = Object.entries(body)
    if (!entries.length) {
      return res.status(400).json({ error: 'No settings provided' })
    }
    for (const [key] of entries) {
      if (!isAllowedKey(key)) {
        return res
          .status(400)
          .json({ error: `Unknown or invalid setting key: ${key}` })
      }
    }

    await client.query('BEGIN')
    for (const [key, value] of entries) {
      const json = JSON.stringify(value === undefined ? null : value)
      if (json.length > MAX_VALUE_BYTES) {
        await client.query('ROLLBACK')
        return res
          .status(413)
          .json({ error: `Value for "${key}" is too large.` })
      }
      await client.query(
        `INSERT INTO system_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), $3)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by`,
        [key, json, req.user.id]
      )
    }
    await client.query('COMMIT')

    const { rows } = await pool.query(
      `SELECT key, value FROM system_settings ORDER BY key ASC`
    )
    const out = {}
    for (const r of rows) out[r.key] = r.value
    return res.json({ settings: out })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[PATCH /admin/settings]', err)
    return res.status(500).json({ error: 'Failed to save settings' })
  } finally {
    client.release()
  }
})

module.exports = router
