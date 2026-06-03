/**
 * One-off helper: re-seed the admin user from .env (ADMIN_EMAIL / ADMIN_PASSWORD)
 * and remove any leftover legacy admin rows that no longer match.
 *
 * Usage:  node db/swap-admin.js
 *
 * Safe to run multiple times. Reads the same env vars as ensureSchema.js.
 */
require('dotenv').config()
const pool = require('./pool')
const { ensureSchema } = require('./ensureSchema')

async function main() {
  const targetEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  if (!targetEmail) {
    console.error('ADMIN_EMAIL not set in .env')
    process.exit(1)
  }

  await ensureSchema()

  const { rows: kept } = await pool.query(
    `SELECT u.id, u.email
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'admin' AND LOWER(u.email) = $1
      LIMIT 1`,
    [targetEmail]
  )
  if (!kept.length) {
    console.error(
      'New admin row not found after seeding. Check ADMIN_EMAIL / ADMIN_PASSWORD.'
    )
    process.exit(2)
  }
  const keepId = kept[0].id

  const { rowCount } = await pool.query(
    `DELETE FROM users
      WHERE id <> $1
        AND role_id = (SELECT id FROM roles WHERE name = 'admin')`,
    [keepId]
  )

  console.log(
    `Admin synced. Kept: ${kept[0].email}. Removed ${rowCount} legacy admin row(s).`
  )
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
