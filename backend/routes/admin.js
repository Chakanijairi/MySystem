const express = require('express')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const pool = require('../db/pool')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()
const uploadDir = path.join(__dirname, '..', 'uploads')

router.use(authenticate, requireAdmin)

router.get('/stats', async (_req, res) => {
  try {
    const [total, pending, active, suspended, docsPending] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM users'),
      pool.query(
        "SELECT COUNT(*)::int AS c FROM users WHERE account_status = 'pending_verification'"
      ),
      pool.query("SELECT COUNT(*)::int AS c FROM users WHERE account_status = 'active'"),
      pool.query("SELECT COUNT(*)::int AS c FROM users WHERE account_status = 'suspended'"),
      pool.query(
        "SELECT COUNT(*)::int AS c FROM documents WHERE verification_status = 'pending'"
      ),
    ])
    return res.json({
      totalUsers: total.rows[0].c,
      pendingVerification: pending.rows[0].c,
      activeAccounts: active.rows[0].c,
      suspendedAccounts: suspended.rows[0].c,
      documentsPendingReview: docsPending.rows[0].c,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load stats' })
  }
})

router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const offset = (page - 1) * limit

    const trim = (v) => (typeof v === 'string' ? v.trim() : '')
    const status = trim(req.query.status)
    const q = trim(req.query.q)
    const memberName = trim(req.query.memberName)
    const phone = trim(req.query.phone)
    const email = trim(req.query.email)
    const address = trim(req.query.address)
    const roleName = trim(req.query.role)
    const position = trim(req.query.position)
    const dateAdded = trim(req.query.dateAdded)
    const excludeAdmin = String(req.query.excludeAdmin || '').toLowerCase() === 'true'
    const yearRaw = req.query.year
    const monthRaw = req.query.month
    const filterYear =
      yearRaw !== undefined && yearRaw !== null && String(yearRaw).trim() !== ''
        ? parseInt(String(yearRaw), 10)
        : null
    const filterMonth =
      monthRaw !== undefined && monthRaw !== null && String(monthRaw).trim() !== ''
        ? parseInt(String(monthRaw), 10)
        : null

    const params = []
    let p = 1
    const clauses = []
    if (excludeAdmin) {
      clauses.push(`r.name <> 'admin'`)
    }
    if (status) {
      clauses.push(`u.account_status = $${p++}`)
      params.push(status)
    }
    if (memberName) {
      clauses.push(`u.full_name ILIKE $${p++}`)
      params.push(`%${memberName}%`)
    }
    if (phone) {
      clauses.push(`u.phone ILIKE $${p++}`)
      params.push(`%${phone}%`)
    }
    if (email) {
      clauses.push(`u.email ILIKE $${p++}`)
      params.push(`%${email}%`)
    }
    if (address) {
      // Match anywhere inside the address JSON sub-object (street/barangay/city/province/region).
      clauses.push(`(u.registration->'address')::text ILIKE $${p++}`)
      params.push(`%${address}%`)
    }
    if (roleName) {
      clauses.push(`r.name ILIKE $${p++}`)
      params.push(roleName)
    }
    if (position) {
      clauses.push(`LOWER(u.member_category) = LOWER($${p++})`)
      params.push(position)
    }
    if (dateAdded && /^\d{4}-\d{2}-\d{2}$/.test(dateAdded)) {
      clauses.push(`u.created_at::date = $${p++}::date`)
      params.push(dateAdded)
    }
    if (q) {
      const term = `%${q}%`
      clauses.push(
        `(u.full_name ILIKE $${p}
          OR u.email ILIKE $${p}
          OR u.phone ILIKE $${p}
          OR CAST(u.id AS text) ILIKE $${p}
          OR u.account_status ILIKE $${p}
          OR r.name ILIKE $${p}
          OR u.registration::text ILIKE $${p})`
      )
      params.push(term)
      p += 1
    }
    if (filterYear !== null && !Number.isNaN(filterYear) && filterYear >= 1970 && filterYear <= 2100) {
      clauses.push(`EXTRACT(YEAR FROM u.created_at)::int = $${p++}`)
      params.push(filterYear)
    }
    if (filterMonth !== null && !Number.isNaN(filterMonth) && filterMonth >= 1 && filterMonth <= 12) {
      clauses.push(`EXTRACT(MONTH FROM u.created_at)::int = $${p++}`)
      params.push(filterMonth)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const countQ = await pool.query(
      `SELECT COUNT(*)::int AS c FROM users u JOIN roles r ON r.id = u.role_id ${where}`,
      params
    )
    const total = countQ.rows[0].c

    const limitPh = `$${p++}`
    const offsetPh = `$${p++}`
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.account_status, u.member_category,
              u.created_at, r.name AS role,
              COALESCE(u.registration->'address'->>'street', '')   AS addr_street,
              COALESCE(u.registration->'address'->>'barangay', '') AS addr_barangay,
              COALESCE(u.registration->'address'->>'city', '')     AS addr_city,
              COALESCE(u.registration->'address'->>'province', '') AS addr_province,
              COALESCE(u.registration->'address'->>'region', '')   AS addr_region,
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
              u.registration, u.recruited_by, u.created_at, u.updated_at,
              r.name AS role, r.id AS role_id
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [req.params.id]
    )
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' })
    }
    const [docs, teamMembers] = await Promise.all([
      pool.query(
        `SELECT id, doc_type, verification_status, uploaded_at, reviewed_at, original_filename, mime_type
         FROM documents WHERE user_id = $1 ORDER BY doc_type`,
        [req.params.id]
      ),
      pool.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.account_status, u.created_at, r.name AS role,
                COALESCE(u.registration->'address'->>'street', '')   AS addr_street,
                COALESCE(u.registration->'address'->>'barangay', '') AS addr_barangay,
                COALESCE(u.registration->'address'->>'city', '')     AS addr_city,
                COALESCE(u.registration->'address'->>'province', '') AS addr_province,
                COALESCE(u.registration->'address'->>'region', '')   AS addr_region
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.recruited_by = $1
         ORDER BY u.created_at DESC`,
        [req.params.id]
      ),
    ])
    return res.json({
      user: users[0],
      documents: docs.rows,
      team_members: teamMembers.rows,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load user' })
  }
})

router.post('/users', async (req, res) => {
  try {
    const b = req.body || {}
    const {
      email,
      password,
      full_name: fullNameRaw,
      first_name,
      last_name,
      middle_name,
      phone,
      how_found_pc,
      addr_street,
      addr_region,
      addr_province,
      addr_city,
      addr_barangay,
      preferred_branch,
      recruiter_id,
      recruiter_name,
      recruiter_mobile,
      recruiter_facebook,
      other_notes,
      role_id,
      account_status,
      member_category,
    } = b

    const { rows: roleCheck } = await pool.query(
      'SELECT id, name FROM roles WHERE id = $1',
      [role_id]
    )
    if (!roleCheck.length) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    if (roleCheck[0].name === 'admin') {
      return res.status(403).json({
        error: 'Admin accounts cannot be created through registration',
      })
    }

    let full_name = fullNameRaw
      ? String(fullNameRaw).trim()
      : [first_name, middle_name, last_name]
          .filter((x) => x && String(x).trim())
          .map((x) => String(x).trim())
          .join(' ')
    if (!full_name) {
      return res.status(400).json({
        error: 'Name is required (first_name and last_name, or full_name)',
      })
    }

    if (
      !email ||
      !password ||
      !phone ||
      !role_id ||
      !addr_street ||
      !addr_region ||
      !addr_province ||
      !addr_city
    ) {
      return res.status(400).json({
        error:
          'Missing required fields: email, password, phone, role, and complete address',
      })
    }

    const registration = {
      first_name: first_name ? String(first_name).trim() : null,
      last_name: last_name ? String(last_name).trim() : null,
      middle_name: middle_name ? String(middle_name).trim() : null,
      how_found_pc: how_found_pc ? String(how_found_pc).trim() : null,
      address: {
        street: String(addr_street).trim(),
        region: String(addr_region).trim(),
        province: String(addr_province).trim(),
        city: String(addr_city).trim(),
        barangay: addr_barangay ? String(addr_barangay).trim() : '',
      },
      ...(preferred_branch
        ? { preferred_branch: String(preferred_branch).trim() }
        : {}),
      recruiter: {
        id_text: recruiter_id ? String(recruiter_id).trim() : '',
        full_name: recruiter_name ? String(recruiter_name).trim() : '',
        mobile: recruiter_mobile ? String(recruiter_mobile).trim() : '',
        facebook: recruiter_facebook ? String(recruiter_facebook).trim() : '',
      },
      other_notes: other_notes ? String(other_notes).trim() : '',
    }

    let recruitedBy = null
    const rid = recruiter_id && String(recruiter_id).trim()
    if (rid && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rid)) {
      const { rows: sp } = await pool.query('SELECT id FROM users WHERE id = $1', [rid])
      if (sp.length) recruitedBy = rid
    }

    const hash = await bcrypt.hash(String(password), 12)
    const { rows } = await pool.query(
      `INSERT INTO users (
         email, password_hash, full_name, phone, role_id, account_status, member_category,
         registration, recruited_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id, email, full_name, phone, account_status, member_category, registration, recruited_by`,
      [
        String(email).toLowerCase().trim(),
        hash,
        full_name,
        String(phone).trim(),
        role_id,
        account_status != null && String(account_status).trim() !== ''
          ? account_status
          : 'pending_verification',
        member_category ? String(member_category).trim() : null,
        JSON.stringify(registration),
        recruitedBy,
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
    const id = req.params.id
    const b = req.body || {}
    const {
      role_id,
      account_status,
      member_category,
      email,
      full_name,
      phone,
      registration,
      recruited_by,
      password,
    } = b

    if (role_id !== undefined) {
      const { rows: rr } = await pool.query('SELECT name FROM roles WHERE id = $1', [
        role_id,
      ])
      if (!rr.length) {
        return res.status(400).json({ error: 'Invalid role' })
      }
      if (rr[0].name === 'admin') {
        const { rows: cur } = await pool.query(
          `SELECT r.name AS rn FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [id]
        )
        if (cur[0]?.rn !== 'admin') {
          return res.status(403).json({ error: 'Cannot promote to admin role here' })
        }
      }
    }

    const fields = []
    const values = []
    let i = 1
    if (email !== undefined) {
      const em = String(email).toLowerCase().trim()
      const { rows: clash } = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [em, id]
      )
      if (clash.length) {
        return res.status(409).json({ error: 'Email already in use' })
      }
      fields.push(`email = $${i++}`)
      values.push(em)
    }
    if (full_name !== undefined) {
      fields.push(`full_name = $${i++}`)
      values.push(String(full_name).trim())
    }
    if (phone !== undefined) {
      fields.push(`phone = $${i++}`)
      values.push(String(phone).trim())
    }
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
    if (registration !== undefined) {
      fields.push(`registration = $${i++}::jsonb`)
      values.push(
        typeof registration === 'string'
          ? registration
          : JSON.stringify(registration)
      )
    }
    if (recruited_by !== undefined) {
      if (recruited_by === null || recruited_by === '') {
        fields.push(`recruited_by = NULL`)
      } else {
        const sid = String(recruited_by).trim()
        if (sid === id) {
          return res.status(400).json({ error: 'Member cannot sponsor themselves' })
        }
        const { rows: sp } = await pool.query('SELECT id FROM users WHERE id = $1', [sid])
        if (!sp.length) {
          return res.status(400).json({ error: 'Sponsor user not found' })
        }
        fields.push(`recruited_by = $${i++}`)
        values.push(sid)
      }
    }
    if (password !== undefined && String(password).length > 0) {
      if (String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }
      const hash = await bcrypt.hash(String(password), 12)
      fields.push(`password_hash = $${i++}`)
      values.push(hash)
    }
    if (!fields.length) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    fields.push(`updated_at = NOW()`)
    values.push(id)
    const q = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, full_name, phone, account_status, member_category, role_id, registration, recruited_by`
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

router.delete('/users/:id', async (req, res) => {
  try {
    const id = req.params.id
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    const { rows: target } = await pool.query(
      `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [id]
    )
    if (!target.length) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (target[0].role_name === 'admin') {
      return res.status(403).json({ error: 'Cannot delete an admin account' })
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id])
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to delete user' })
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

/**
 * Members whose team count (direct recruits) exceeds the configured threshold
 * and are therefore eligible for promotion to the next rank. The admin
 * dashboard surfaces this as a notification banner.
 *
 *   GET /api/admin/promotion-candidates?threshold=5
 */
router.get('/promotion-candidates', async (req, res) => {
  try {
    const raw = parseInt(req.query.threshold, 10)
    const threshold = Number.isFinite(raw) && raw > 0 ? raw : 5
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, r.name AS role,
              (SELECT COUNT(*)::int FROM users d WHERE d.recruited_by = u.id) AS team_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name <> 'admin'
       AND (SELECT COUNT(*) FROM users d WHERE d.recruited_by = u.id) > $1
       ORDER BY team_count DESC, u.full_name ASC
       LIMIT 50`,
      [threshold]
    )
    return res.json({ threshold, candidates: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load promotion candidates' })
  }
})

module.exports = router
