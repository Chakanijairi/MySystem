const express = require('express')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const pool = require('../db/pool')
const { sendOtpEmail, isMailerReady } = require('../services/mailer')

const router = express.Router()

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_TOKEN_TTL = '10m'
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_TTL_MIN = Math.round(OTP_TTL_MS / 60000)
const OTP_MAX_ATTEMPTS = 5

function maskEmail(value) {
  const [local, domain] = String(value).split('@')
  if (!local || !domain) return value
  const visible = local.slice(0, Math.min(3, local.length))
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`
}

function normalizeEmail(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (!emailRe.test(trimmed)) return ''
  return trimmed.toLowerCase()
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function getJwtSecret() {
  return process.env.JWT_SECRET
}

function isPasswordStrong(pw) {
  const s = String(pw || '')
  return s.length >= 8 && /[A-Z]/.test(s) && /\d/.test(s)
}

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
      "SELECT id FROM roles WHERE name = 'member'"
    )
    if (!roleRows.length) {
      return res.status(500).json({ error: 'Member role not configured' })
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

/**
 * POST /api/auth/forgot-password
 * Body: { identifier }  (email address)
 * Sends a 6-digit OTP to the user's registered email via SMTP.
 * Always returns 200 with a masked destination (even on a miss) to avoid leaking
 * which accounts exist.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body || {}
    const email = normalizeEmail(identifier)
    if (!email) {
      return res.status(400).json({ error: 'Enter a valid email address' })
    }

    const { rows } = await pool.query(
      'SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    )
    const userRow = rows[0] || null

    if (!userRow) {
      // Don't disclose existence — pretend we sent it.
      return res.json({
        ok: true,
        channel: 'email',
        destination: maskEmail(email),
      })
    }

    if (!isMailerReady()) {
      console.error(
        '[forgot-password] SMTP is not configured. Set SMTP_USER and SMTP_PASS in backend/.env to enable email delivery.'
      )
      return res.status(503).json({
        error:
          'Email delivery is not configured on the server. Ask the administrator to set SMTP_USER and SMTP_PASS.',
      })
    }

    const code = generateOtp()
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)
    const destinationRaw = userRow.email

    await pool.query(
      `UPDATE password_resets
         SET consumed_at = NOW()
       WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()`,
      [userRow.id]
    )

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO password_resets (user_id, destination, channel, code_hash, expires_at)
       VALUES ($1, $2, 'email', $3, $4)
       RETURNING id`,
      [userRow.id, destinationRaw, codeHash, expiresAt]
    )
    const resetId = insertedRows[0].id

    try {
      await sendOtpEmail({
        to: destinationRaw,
        code,
        expiresInMin: OTP_TTL_MIN,
      })
    } catch (mailErr) {
      console.error('[forgot-password] sendOtpEmail failed:', mailErr.message)
      await pool.query(
        'UPDATE password_resets SET consumed_at = NOW() WHERE id = $1',
        [resetId]
      )
      return res.status(502).json({
        error: 'Could not send the verification email. Please try again in a moment.',
      })
    }

    console.log(
      `[forgot-password] Sent OTP to ${destinationRaw} (expires ${expiresAt.toISOString()})`
    )

    return res.json({
      ok: true,
      channel: 'email',
      destination: maskEmail(destinationRaw),
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('[forgot-password]', err)
    return res.status(500).json({ error: 'Could not start password reset' })
  }
})

/**
 * POST /api/auth/verify-otp
 * Body: { identifier, code }
 * Returns: { reset_token } — short-lived JWT that the reset endpoint accepts.
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { identifier, code } = req.body || {}
    const email = normalizeEmail(identifier)
    const cleanCode = String(code || '').trim()
    if (!email || !/^\d{4,8}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Invalid verification code' })
    }

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    )
    const userRow = rows[0] || null
    if (!userRow) {
      return res.status(400).json({ error: 'Invalid or expired code' })
    }

    const { rows: resetRows } = await pool.query(
      `SELECT id, code_hash, attempts, expires_at
         FROM password_resets
        WHERE user_id = $1 AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [userRow.id]
    )
    const reset = resetRows[0]
    if (!reset) {
      return res.status(400).json({ error: 'No active verification code. Request a new one.' })
    }
    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Verification code expired. Request a new one.' })
    }
    if (reset.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query(
        'UPDATE password_resets SET consumed_at = NOW() WHERE id = $1',
        [reset.id]
      )
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' })
    }

    const ok = await bcrypt.compare(cleanCode, reset.code_hash)
    if (!ok) {
      await pool.query(
        'UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1',
        [reset.id]
      )
      return res.status(400).json({ error: 'Incorrect verification code' })
    }

    const secret = getJwtSecret()
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    const reset_token = jwt.sign(
      { sub: String(userRow.id), prid: reset.id, purpose: 'pw_reset' },
      secret,
      { expiresIn: RESET_TOKEN_TTL }
    )

    return res.json({ ok: true, reset_token })
  } catch (err) {
    console.error('[verify-otp]', err)
    return res.status(500).json({ error: 'Could not verify code' })
  }
})

/**
 * POST /api/auth/reset-password
 * Body: { reset_token, password }
 * Sets the new password and burns the OTP record.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { reset_token, password } = req.body || {}
    if (!reset_token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required' })
    }
    if (!isPasswordStrong(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include an uppercase letter and a number',
      })
    }

    const secret = getJwtSecret()
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    let payload
    try {
      payload = jwt.verify(reset_token, secret)
    } catch {
      return res.status(401).json({ error: 'Reset link expired. Start over.' })
    }
    if (!payload || payload.purpose !== 'pw_reset' || !payload.sub || !payload.prid) {
      return res.status(401).json({ error: 'Invalid reset token' })
    }

    const { rows: resetRows } = await pool.query(
      'SELECT id, user_id, consumed_at FROM password_resets WHERE id = $1 LIMIT 1',
      [payload.prid]
    )
    const reset = resetRows[0]
    if (!reset || reset.consumed_at || String(reset.user_id) !== String(payload.sub)) {
      return res.status(401).json({ error: 'Reset link no longer valid' })
    }

    const hash = await bcrypt.hash(String(password), 12)
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, payload.sub]
    )
    await pool.query(
      `UPDATE password_resets SET consumed_at = NOW() WHERE id = $1`,
      [reset.id]
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error('[reset-password]', err)
    return res.status(500).json({ error: 'Could not reset password' })
  }
})

module.exports = router
