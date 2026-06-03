const express = require('express')
const pool = require('../db/pool')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate, requireAdmin)

const FEATURE_KEYS = [
  'dashboard',
  'viewMembers',
  'registerMembers',
  'editMembers',
  'activate',
  'viewSales',
  'recordSale',
  'managePromotions',
  'systemSettings',
]

const VALID_PERM_RE = /^(full|none|partial:.{0,255})$/

function validatePermValue(v) {
  if (typeof v !== 'string') return false
  return VALID_PERM_RE.test(v)
}

function sanitizeRoleName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .slice(0, 50)
}

async function fetchAllRoles() {
  const { rows: roles } = await pool.query(
    `SELECT r.id, r.name, r.display_name, r.access_level, r.color, r.description,
            r.builtin, r.created_at, r.updated_at,
            (SELECT COUNT(*)::int FROM users u WHERE u.role_id = r.id) AS member_count
       FROM roles r
       ORDER BY r.builtin DESC, r.id ASC`
  )
  if (!roles.length) return []

  const ids = roles.map((r) => r.id)
  const { rows: perms } = await pool.query(
    `SELECT role_id, feature_key, value
       FROM role_permissions
       WHERE role_id = ANY ($1::int[])`,
    [ids]
  )
  const byRole = new Map()
  for (const p of perms) {
    if (!byRole.has(p.role_id)) byRole.set(p.role_id, {})
    byRole.get(p.role_id)[p.feature_key] = p.value
  }
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    display_name: r.display_name || r.name,
    access_level: r.access_level || 'Standard',
    color: r.color || 'slate',
    description: r.description || '',
    builtin: !!r.builtin,
    member_count: r.member_count,
    permissions: byRole.get(r.id) || {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

router.get('/roles', async (_req, res) => {
  try {
    const roles = await fetchAllRoles()
    return res.json({ roles })
  } catch (err) {
    console.error('[GET /admin/roles]', err)
    return res.status(500).json({ error: 'Failed to list roles' })
  }
})

router.post('/roles', async (req, res) => {
  const client = await pool.connect()
  try {
    const {
      display_name,
      name,
      access_level,
      color,
      description,
      permissions,
    } = req.body || {}

    const cleanDisplay = String(display_name || name || '').trim()
    if (!cleanDisplay) {
      return res.status(400).json({ error: 'Role name is required' })
    }
    const cleanName = sanitizeRoleName(name || cleanDisplay)
    if (!cleanName) {
      return res.status(400).json({ error: 'Role name is invalid' })
    }

    await client.query('BEGIN')

    const { rows: existing } = await client.query(
      'SELECT id FROM roles WHERE LOWER(name) = $1',
      [cleanName]
    )
    if (existing.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'A role with this name already exists' })
    }

    const { rows: ins } = await client.query(
      `INSERT INTO roles (name, display_name, access_level, color, description, builtin)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id`,
      [
        cleanName,
        cleanDisplay,
        access_level || 'Standard',
        color || 'slate',
        description || '',
      ]
    )
    const roleId = ins[0].id

    const incoming = permissions && typeof permissions === 'object' ? permissions : {}
    for (const key of FEATURE_KEYS) {
      const v = incoming[key] && validatePermValue(incoming[key]) ? incoming[key] : 'none'
      await client.query(
        `INSERT INTO role_permissions (role_id, feature_key, value) VALUES ($1, $2, $3)`,
        [roleId, key, v]
      )
    }

    await client.query('COMMIT')
    const all = await fetchAllRoles()
    const role = all.find((r) => r.id === roleId)
    return res.status(201).json({ role })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A role with this name already exists' })
    }
    console.error('[POST /admin/roles]', err)
    return res.status(500).json({ error: 'Failed to create role' })
  } finally {
    client.release()
  }
})

router.patch('/roles/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid role id' })
    }
    const { rows: cur } = await client.query(
      'SELECT id, name, builtin FROM roles WHERE id = $1',
      [id]
    )
    if (!cur.length) {
      return res.status(404).json({ error: 'Role not found' })
    }
    const role = cur[0]
    const {
      display_name,
      name,
      access_level,
      color,
      description,
      permissions,
    } = req.body || {}

    await client.query('BEGIN')

    const fields = []
    const values = []
    let p = 1
    if (display_name !== undefined) {
      fields.push(`display_name = $${p++}`)
      values.push(String(display_name).trim() || role.name)
    }
    if (!role.builtin && name !== undefined) {
      const newName = sanitizeRoleName(name)
      if (!newName) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid role name' })
      }
      const { rows: clash } = await client.query(
        'SELECT id FROM roles WHERE LOWER(name) = $1 AND id <> $2',
        [newName, id]
      )
      if (clash.length) {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'A role with this name already exists' })
      }
      fields.push(`name = $${p++}`)
      values.push(newName)
    }
    if (access_level !== undefined) {
      fields.push(`access_level = $${p++}`)
      values.push(String(access_level || 'Standard'))
    }
    if (color !== undefined) {
      fields.push(`color = $${p++}`)
      values.push(String(color || 'slate'))
    }
    if (description !== undefined) {
      fields.push(`description = $${p++}`)
      values.push(String(description || ''))
    }
    if (fields.length) {
      fields.push(`updated_at = NOW()`)
      values.push(id)
      await client.query(
        `UPDATE roles SET ${fields.join(', ')} WHERE id = $${p}`,
        values
      )
    }

    if (permissions && typeof permissions === 'object') {
      for (const [key, raw] of Object.entries(permissions)) {
        if (!FEATURE_KEYS.includes(key)) continue
        const v = validatePermValue(raw) ? raw : 'none'
        await client.query(
          `INSERT INTO role_permissions (role_id, feature_key, value, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (role_id, feature_key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = NOW()`,
          [id, key, v]
        )
      }
    }

    await client.query('COMMIT')
    const all = await fetchAllRoles()
    return res.json({ role: all.find((r) => r.id === id) })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[PATCH /admin/roles/:id]', err)
    return res.status(500).json({ error: 'Failed to update role' })
  } finally {
    client.release()
  }
})

router.delete('/roles/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid role id' })
    }
    const { rows } = await pool.query(
      `SELECT id, name, builtin,
              (SELECT COUNT(*)::int FROM users u WHERE u.role_id = roles.id) AS member_count
         FROM roles WHERE id = $1`,
      [id]
    )
    const role = rows[0]
    if (!role) {
      return res.status(404).json({ error: 'Role not found' })
    }
    if (role.builtin) {
      return res.status(403).json({ error: 'Built-in roles cannot be deleted' })
    }
    if (role.member_count > 0) {
      return res.status(409).json({
        error: `Cannot delete role: ${role.member_count} user(s) are still assigned. Reassign them first.`,
      })
    }
    await pool.query('DELETE FROM roles WHERE id = $1', [id])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /admin/roles/:id]', err)
    return res.status(500).json({ error: 'Failed to delete role' })
  }
})

module.exports = router
module.exports.FEATURE_KEYS = FEATURE_KEYS
