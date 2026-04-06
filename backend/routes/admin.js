const express = require('express')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const pool = require('../db/pool')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()
const uploadDir = path.join(__dirname, '..', 'uploads')

router.use(authenticate, requireAdmin)

router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const offset = (page - 1) * limit
    const status = req.query.status

    const params = []
    let p = 1
    let where = ''
    if (status) {
      where = `WHERE u.account_status = $${p++}`
      params.push(status)
    }

    const countQ = await pool.query(
      `SELECT COUNT(*)::int AS c FROM users u ${where}`,
      params
    )
    const total = countQ.rows[0].c

    const limitPh = `$${p++}`
    const offsetPh = `$${p++}`
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.account_status, u.member_category,
              u.created_at, r.name AS role,
              (SELECT COUNT(*)::int FROM documents d WHERE d.user_id = u.id AND d.verification_status = 'approved') AS approved_docs,
              (SELECT COUNT(*)::int FROM documents d WHERE d.user_id = u.id AND d.doc_type IN ('national_id','utility_bill')) AS required_docs
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ${limitPh} OFFSET ${offsetPh}`,
      params
    )

    return res.json({ users: rows, page, limit, total })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to list users' })
  }
})

router.get('/users/:id', async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.account_status, u.member_category,
              u.created_at, r.name AS role, r.id AS role_id
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [req.params.id]
    )
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' })
    }
    const { rows: docs } = await pool.query(
      `SELECT id, doc_type, verification_status, uploaded_at, reviewed_at, original_filename, mime_type
       FROM documents WHERE user_id = $1 ORDER BY doc_type`,
      [req.params.id]
    )
    return res.json({ user: users[0], documents: docs })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load user' })
  }
})

router.post('/users', async (req, res) => {
  try {
    const {
      email,
      password,
      full_name,
      phone,
      role_id,
      account_status,
      member_category,
    } = req.body || {}
    if (!email || !password || !full_name || !phone || !role_id) {
      return res.status(400).json({
        error: 'email, password, full_name, phone, and role_id are required',
      })
    }
    const hash = await bcrypt.hash(String(password), 12)
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role_id, account_status, member_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, phone, account_status, member_category`,
      [
        String(email).toLowerCase().trim(),
        hash,
        String(full_name).trim(),
        String(phone).trim(),
        role_id,
        account_status || 'pending_verification',
        member_category ? String(member_category).trim() : null,
      ]
    )
    return res.status(201).json({ user: rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' })
    }
    console.error(err)
    return res.status(500).json({ error: 'Failed to create user' })
  }
})

router.patch('/users/:id', async (req, res) => {
  try {
    const { role_id, account_status, member_category } = req.body || {}
    const id = req.params.id
    const fields = []
    const values = []
    let i = 1
    if (role_id !== undefined) {
      fields.push(`role_id = $${i++}`)
      values.push(role_id)
    }
    if (account_status !== undefined) {
      fields.push(`account_status = $${i++}`)
      values.push(account_status)
    }
    if (member_category !== undefined) {
      fields.push(`member_category = $${i++}`)
      values.push(member_category)
    }
    if (!fields.length) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    fields.push(`updated_at = NOW()`)
    values.push(id)
    const q = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, full_name, phone, account_status, member_category, role_id`
    const { rows } = await pool.query(q, values)
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' })
    }
    const { rows: r } = await pool.query('SELECT name FROM roles WHERE id = $1', [
      rows[0].role_id,
    ])
    return res.json({
      user: {
        ...rows[0],
        role: r[0]?.name,
      },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update user' })
  }
})

router.post('/documents/:id/review', async (req, res) => {
  try {
    const { status } = req.body || {}
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' })
    }
    const { rows } = await pool.query(
      `UPDATE documents SET
         verification_status = $1,
         reviewed_at = NOW(),
         reviewed_by = $2
       WHERE id = $3
       RETURNING id, user_id, doc_type, verification_status`,
      [status, req.user.id, req.params.id]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    return res.json({ document: rows[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to review document' })
  }
})

router.get('/documents/:id/file', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT storage_path, original_filename, mime_type FROM documents WHERE id = $1',
      [req.params.id]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Document not found' })
    }
    const { storage_path, original_filename, mime_type } = rows[0]
    const safe = path.basename(storage_path)
    const full = path.join(uploadDir, safe)
    if (!full.startsWith(uploadDir) || !fs.existsSync(full)) {
      return res.status(404).json({ error: 'File missing' })
    }
    res.setHeader('Content-Type', mime_type || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(original_filename)}"`
    )
    fs.createReadStream(full).pipe(res)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load file' })
  }
})

router.get('/roles', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM roles ORDER BY id')
    return res.json({ roles: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to list roles' })
  }
})

router.get('/sales', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.dealer_id, s.amount, s.commission_amount, s.sale_date, s.notes, s.created_at,
              u.full_name AS dealer_name
       FROM sales s
       JOIN users u ON u.id = s.dealer_id
       ORDER BY s.sale_date DESC, s.created_at DESC
       LIMIT 500`
    )
    return res.json({ sales: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to list sales' })
  }
})

router.post('/sales', async (req, res) => {
  try {
    const { dealer_id, amount, commission_amount, sale_date, notes } = req.body || {}
    if (!dealer_id || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'dealer_id and amount are required' })
    }
    const { rows } = await pool.query(
      `INSERT INTO sales (dealer_id, amount, commission_amount, sale_date, notes)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5)
       RETURNING *`,
      [
        dealer_id,
        amount,
        commission_amount ?? null,
        sale_date || null,
        notes ? String(notes) : null,
      ]
    )
    return res.status(201).json({ sale: rows[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to record sale' })
  }
})

router.get('/installments', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.full_name AS dealer_name
       FROM installments i
       JOIN users u ON u.id = i.dealer_id
       ORDER BY i.due_date DESC
       LIMIT 500`
    )
    return res.json({ installments: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to list installments' })
  }
})

router.post('/installments', async (req, res) => {
  try {
    const { dealer_id, sale_id, amount, due_date, status } = req.body || {}
    if (!dealer_id || amount === undefined || !due_date) {
      return res.status(400).json({ error: 'dealer_id, amount, and due_date are required' })
    }
    const { rows } = await pool.query(
      `INSERT INTO installments (dealer_id, sale_id, amount, due_date, status)
       VALUES ($1, $2, $3, $4::date, COALESCE($5, 'pending'))
       RETURNING *`,
      [dealer_id, sale_id || null, amount, due_date, status || null]
    )
    return res.status(201).json({ installment: rows[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create installment' })
  }
})

router.patch('/installments/:id', async (req, res) => {
  try {
    const { paid_at, status } = req.body || {}
    const fields = []
    const values = []
    let i = 1
    if (paid_at !== undefined) {
      fields.push(`paid_at = $${i++}`)
      values.push(paid_at ? new Date(paid_at) : null)
    }
    if (status !== undefined) {
      fields.push(`status = $${i++}`)
      values.push(status)
    }
    if (!fields.length) {
      return res.status(400).json({ error: 'No valid fields' })
    }
    values.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE installments SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Not found' })
    }
    return res.json({ installment: rows[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update installment' })
  }
})

module.exports = router
