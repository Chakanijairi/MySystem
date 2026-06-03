const express = require('express')
const pool = require('../db/pool')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate, requireAdmin)

const ALLOWED_TYPES = ['promotion', 'announcement', 'notice', 'event']
const ALLOWED_VISIBILITY = ['all', 'members', 'managers', 'directors', 'executives']
const ALLOWED_STATUS = [null, '', 'draft', 'scheduled', 'expired']

function fmtDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function rowToPromotion(r) {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    message: r.message,
    startDate: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : '',
    endDate: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : '',
    visibility: r.visibility,
    bannerDataUrl: r.banner_data_url || '',
    percentOff: r.percent_off,
    published: r.published,
    archived: r.archived,
    manualStatus: r.manual_status,
    views: r.views,
    salesLinked: r.sales_linked,
    createdBy: r.created_by_name || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function sanitizeBody(body, isCreate) {
  const out = {}
  if (body.title !== undefined) {
    const t = String(body.title || '').trim()
    if (isCreate && !t) throw Object.assign(new Error('title is required'), { status: 400 })
    out.title = t.slice(0, 255)
  }
  if (body.type !== undefined) {
    const t = String(body.type || '').trim() || 'promotion'
    if (!ALLOWED_TYPES.includes(t)) {
      throw Object.assign(new Error('Invalid type'), { status: 400 })
    }
    out.type = t
  }
  if (body.message !== undefined) {
    out.message = String(body.message || '')
  }
  if (body.startDate !== undefined) {
    out.start_date = fmtDate(body.startDate)
  }
  if (body.endDate !== undefined) {
    out.end_date = fmtDate(body.endDate)
  }
  if (body.visibility !== undefined) {
    const v = String(body.visibility || 'all').trim() || 'all'
    if (!ALLOWED_VISIBILITY.includes(v)) {
      throw Object.assign(new Error('Invalid visibility'), { status: 400 })
    }
    out.visibility = v
  }
  if (body.bannerDataUrl !== undefined) {
    out.banner_data_url = body.bannerDataUrl ? String(body.bannerDataUrl) : null
  }
  if (body.percentOff !== undefined) {
    if (body.percentOff === null || body.percentOff === '') {
      out.percent_off = null
    } else {
      const n = parseInt(body.percentOff, 10)
      out.percent_off = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null
    }
  }
  if (body.published !== undefined) {
    out.published = !!body.published
  }
  if (body.archived !== undefined) {
    out.archived = !!body.archived
  }
  if (body.manualStatus !== undefined) {
    const s = body.manualStatus || ''
    if (!ALLOWED_STATUS.includes(s)) {
      throw Object.assign(new Error('Invalid manualStatus'), { status: 400 })
    }
    out.manual_status = s || null
  }
  if (body.views !== undefined) {
    const n = parseInt(body.views, 10)
    out.views = Number.isFinite(n) ? Math.max(0, n) : 0
  }
  if (body.salesLinked !== undefined) {
    const n = parseInt(body.salesLinked, 10)
    out.sales_linked = Number.isFinite(n) ? Math.max(0, n) : 0
  }
  return out
}

router.get('/promotions', async (req, res) => {
  try {
    const includeArchived =
      String(req.query.includeArchived || 'true').toLowerCase() === 'true'
    const where = includeArchived ? '' : 'WHERE archived = FALSE'
    const { rows } = await pool.query(
      `SELECT * FROM promotions ${where} ORDER BY created_at DESC LIMIT 500`
    )
    return res.json({ promotions: rows.map(rowToPromotion) })
  } catch (err) {
    console.error('[GET /admin/promotions]', err)
    return res.status(500).json({ error: 'Failed to load promotions' })
  }
})

router.get('/promotions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM promotions WHERE id = $1',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    return res.json({ promotion: rowToPromotion(rows[0]) })
  } catch (err) {
    console.error('[GET /admin/promotions/:id]', err)
    return res.status(500).json({ error: 'Failed to load promotion' })
  }
})

router.post('/promotions', async (req, res) => {
  try {
    const fields = sanitizeBody(req.body || {}, true)
    if (!fields.title) {
      return res.status(400).json({ error: 'title is required' })
    }
    const cols = []
    const placeholders = []
    const values = []
    let p = 1
    for (const [k, v] of Object.entries(fields)) {
      cols.push(k)
      placeholders.push(`$${p++}`)
      values.push(v)
    }
    cols.push('created_by', 'created_by_name')
    placeholders.push(`$${p++}`, `$${p++}`)
    values.push(req.user.id, req.user.full_name || req.user.email)

    const { rows } = await pool.query(
      `INSERT INTO promotions (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    )
    return res.status(201).json({ promotion: rowToPromotion(rows[0]) })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[POST /admin/promotions]', err)
    return res.status(500).json({ error: 'Failed to create promotion' })
  }
})

router.patch('/promotions/:id', async (req, res) => {
  try {
    const fields = sanitizeBody(req.body || {}, false)
    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: 'No valid fields' })
    }
    const sets = []
    const values = []
    let p = 1
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${p++}`)
      values.push(v)
    }
    sets.push('updated_at = NOW()')
    values.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE promotions SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    return res.json({ promotion: rowToPromotion(rows[0]) })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('[PATCH /admin/promotions/:id]', err)
    return res.status(500).json({ error: 'Failed to update promotion' })
  }
})

router.delete('/promotions/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM promotions WHERE id = $1',
      [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'Not found' })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /admin/promotions/:id]', err)
    return res.status(500).json({ error: 'Failed to delete promotion' })
  }
})

router.post('/promotions/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body || {}
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids array is required' })
    }
    const safeIds = ids
      .map((x) => String(x))
      .filter((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x))
    if (!safeIds.length) {
      return res.status(400).json({ error: 'No valid ids' })
    }
    const { rowCount } = await pool.query(
      `DELETE FROM promotions WHERE id = ANY ($1::uuid[])`,
      [safeIds]
    )
    return res.json({ ok: true, deleted: rowCount })
  } catch (err) {
    console.error('[POST /admin/promotions/bulk-delete]', err)
    return res.status(500).json({ error: 'Failed to delete promotions' })
  }
})

router.post('/promotions/archive-expired', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE promotions
          SET archived = TRUE,
              published = FALSE,
              manual_status = 'expired',
              updated_at = NOW()
        WHERE archived = FALSE
          AND end_date IS NOT NULL
          AND end_date < CURRENT_DATE`
    )
    return res.json({ ok: true, archived: rowCount })
  } catch (err) {
    console.error('[POST /admin/promotions/archive-expired]', err)
    return res.status(500).json({ error: 'Failed to archive expired promotions' })
  }
})

module.exports = router
