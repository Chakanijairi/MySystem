/**
 * One-off migration: add `registration` and `recruited_by` columns to the
 * `users` table when they are missing on older databases. Safe to re-run.
 */
require('dotenv').config()
const pool = require('./pool')

async function main() {
  const steps = [
    {
      label: 'Add users.registration JSONB',
      sql: `ALTER TABLE users
            ADD COLUMN IF NOT EXISTS registration JSONB NOT NULL DEFAULT '{}'::jsonb`,
    },
    {
      label: 'Add users.recruited_by UUID',
      sql: `ALTER TABLE users
            ADD COLUMN IF NOT EXISTS recruited_by UUID REFERENCES users (id) ON DELETE SET NULL`,
    },
    {
      label: 'Index idx_users_recruited_by',
      sql: `CREATE INDEX IF NOT EXISTS idx_users_recruited_by ON users (recruited_by)`,
    },
  ]

  for (const step of steps) {
    process.stdout.write(`→ ${step.label} … `)
    await pool.query(step.sql)
    console.log('ok')
  }

  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users' ORDER BY ordinal_position`
  )
  console.log('\nusers columns now:')
  rows.forEach((r) => console.log('  -', r.column_name))

  await pool.end()
}

main().catch(async (err) => {
  console.error('Migration failed:', err.message)
  try {
    await pool.end()
  } catch {}
  process.exit(1)
})
