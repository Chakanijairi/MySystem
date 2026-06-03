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

/**
 * requirePermission(featureKey) — authorize against the role_permissions table.
 *
 * - Admin always passes.
 * - For everyone else: looks up the user's role + featureKey in role_permissions.
 *   - 'full'              → allow, sets req.permissionMode = 'full'
 *   - 'partial:<note>'    → allow, sets req.permissionMode = 'partial' and req.permissionNote
 *                            (route handlers should still scope queries to the user)
 *   - 'none' / missing    → 403
 *
 * Use it like: router.get('/sales', authenticate, requirePermission('viewSales'), handler)
 */
function requirePermission(featureKey) {
  return async function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (req.user.role === 'admin') {
      req.permissionMode = 'full'
      return next()
    }
    try {
      const { rows } = await pool.query(
        `SELECT rp.value
           FROM role_permissions rp
           JOIN roles r ON r.id = rp.role_id
          WHERE r.name = $1 AND rp.feature_key = $2`,
        [req.user.role, featureKey]
      )
      const value = rows[0]?.value || 'none'
      if (value === 'none') {
        return res.status(403).json({
          error: `You don't have permission to access this feature (${featureKey}).`,
        })
      }
      if (value === 'full') {
        req.permissionMode = 'full'
      } else if (typeof value === 'string' && value.startsWith('partial:')) {
        req.permissionMode = 'partial'
        req.permissionNote = value.slice('partial:'.length)
      } else {
        req.permissionMode = 'full'
      }
      return next()
    } catch (err) {
      console.error('[requirePermission]', err)
      return res.status(500).json({ error: 'Permission check failed' })
    }
  }
}

module.exports = { authenticate, requireAdmin, requirePermission }
