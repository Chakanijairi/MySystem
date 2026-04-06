const jwt = require('jsonwebtoken')
const pool = require('../db/pool')

function getBearerToken(req) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return null
  return h.slice(7)
}

async function authenticate(req, res, next) {
  const token = getBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.account_status, u.member_category,
              r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.sub]
    )
    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' })
    }
    req.user = rows[0]
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

module.exports = { authenticate, requireAdmin }
