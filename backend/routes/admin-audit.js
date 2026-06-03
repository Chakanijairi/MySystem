const express = require('express')
const pool = require('../db/pool')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate, requireAdmin)

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim()
  }
  const ip = req.ip || req.socket?.remoteAddress || ''
  return String(ip).replace(/^::ffff:/, '') || 'local'
}

function rowToEvent(r) {
  return {
    id: r.id,
    at: r.created_at,
    user: r.user_label,
    userRole: r.user_role,
    type: r.type,
    action: r.action,
    detail: r.detail || '',
    ip: r.ip || '',
  }
}

router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200))
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const offset = (page - 1) * limit
    const q = String(req.query.q || '').trim()
    const type = String(req.query.type || '').trim()
    const action = String(req.query.action || '').trim()
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()

    const clauses = []
    const params = []
    let p = 1
    if (q) {
      clauses.push(`(user_label ILIKE $${p} OR action ILIKE $${p} OR detail ILIKE $${p})`)
      params.push(`%${q}%`)
      p += 1
    }
    if (type) {
      clauses.push(`type = $${p++}`)
      params.push(type)
    }
    if (action) {
      clauses.push(`action = $${p++}`)
      params.push(action)
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      clauses.push(`created_at >= $${p++}::date`)
      params.push(from)
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      clauses.push(`created_at < ($${p++}::date + INTERVAL '1 day')`)
      params.push(to)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM audit_events ${where}`,
      params
    )
    const total = countRows[0].c

    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT id, user_id, user_label, user_role, type, action, detail, ip, created_at
         FROM audit_events
         ${where}
         ORDER BY created_at DESC
         LIMIT $${p++} OFFSET $${p++}`,
      params
    )

    return res.json({
      events: rows.map(rowToEvent),
      page,
      limit,
      total,
    })
  } catch (err) {
    console.error('[GET /admin/audit]', err)
    return res.status(500).json({ error: 'Failed to load audit log' })
  }
})

router.get('/audit/actions', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT action FROM audit_events ORDER BY action ASC LIMIT 100`
    )
    return res.json({ actions: rows.map((r) => r.action) })
  } catch (err) {
    console.error('[GET /admin/audit/actions]', err)
    return res.status(500).json({ error: 'Failed to load actions' })
  }
})

router.post('/audit', async (req, res) => {
  try {
    const { type, action, detail } = req.body || {}
    if (!action || !String(action).trim()) {
      return res.status(400).json({ error: 'action is required' })
    }
    const userLabel =
      req.user.full_name || req.user.email || 'Admin'
    const userRole = req.user.role || 'admin'
    const ip = clientIp(req)
    const { rows } = await pool.query(
      `INSERT INTO audit_events (user_id, user_label, user_role, type, action, detail, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, user_label, user_role, type, action, detail, ip, created_at`,
      [
        req.user.id,
        userLabel,
        userRole,
        String(type || 'system').slice(0, 50),
        String(action).slice(0, 255),
        detail ? String(detail) : null,
        ip,
      ]
    )
    return res.status(201).json({ event: rowToEvent(rows[0]) })
  } catch (err) {
    console.error('[POST /admin/audit]', err)
    return res.status(500).json({ error: 'Failed to record audit event' })
  }
})

module.exports = router
