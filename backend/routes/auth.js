const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../db/pool')

const router = express.Router()

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, phone, member_category } = req.body || {}
    if (!email || !password || !full_name || !phone) {
      return res.status(400).json({
        error: 'email, password, full_name, and phone are required',
      })
    }
    if (!emailRe.test(String(email))) {
      return res.status(400).json({ error: 'Invalid email format' })
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const { rows: roleRows } = await pool.query(
      "SELECT id FROM roles WHERE name = 'dealer'"
    )
    if (!roleRows.length) {
      return res.status(500).json({ error: 'Dealer role not configured' })
    }

    const hash = await bcrypt.hash(String(password), 12)
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role_id, account_status, member_category)
       VALUES ($1, $2, $3, $4, $5, 'pending_verification', $6)
       RETURNING id, email, full_name, phone, account_status, member_category`,
      [
        String(email).toLowerCase().trim(),
        hash,
        String(full_name).trim(),
        String(phone).trim(),
        roleRows[0].id,
        member_category ? String(member_category).trim() : null,
      ]
    )
    return res.status(201).json({
      message:
        'Account created. Sign in and upload your valid ID and utility bill for verification.',
      user: rows[0],
    })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' })
    }
    console.error(err)
    return res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body || {}
    const loginId = String(email || username || '')
      .trim()
      .toLowerCase()
    if (!loginId || !password) {
      return res.status(400).json({
        error: 'username (or email) and password are required',
      })
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.account_status,
              u.member_category, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [loginId]
    )
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const user = rows[0]
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    let ok = false
    try {
      ok = await bcrypt.compare(String(password), user.password_hash)
    } catch (e) {
      console.error('[login] bcrypt compare error', e)
      return res.status(401).json({ error: 'Invalid username or password' })
    }
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('[login] JWT_SECRET missing at runtime')
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    const token = jwt.sign({ sub: String(user.id) }, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    })

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        account_status: user.account_status,
        member_category: user.member_category,
      },
    })
  } catch (err) {
    console.error('[login]', err)
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'Cannot reach the database. Check DATABASE_URL (Supabase) on Render.',
      })
    }
    if (err.code && String(err.code).startsWith('28')) {
      return res.status(503).json({
        error: 'Database rejected the connection. Check DATABASE_URL password and SSL settings.',
      })
    }
    if (err.code === '42P01') {
      return res.status(503).json({
        error:
          'Database tables are missing. From your machine run: cd backend && npm run db:init (with DATABASE_URL pointing at Supabase).',
      })
    }
    return res.status(500).json({ error: 'Login failed' })
  }
})

module.exports = router
