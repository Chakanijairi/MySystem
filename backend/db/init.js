require('dotenv').config()
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const { Pool } = require('pg')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('Set DATABASE_URL in backend/.env')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  await pool.query(sql)

  await pool.query(`
    INSERT INTO roles (name) VALUES
      ('admin'),
      ('dealer'),
      ('manager'),
      ('director'),
      ('executive')
    ON CONFLICT (name) DO NOTHING
  `)

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const fullName = (process.env.ADMIN_FULL_NAME || 'Shaw').trim()
  if (email && password) {
    const { rows: roles } = await pool.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    )
    const adminRoleId = roles[0].id
    const hash = await bcrypt.hash(password, 12)
    const { rowCount } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role_id, account_status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         role_id = EXCLUDED.role_id,
         account_status = 'active',
         updated_at = NOW()`,
      [email, hash, fullName, '0000000000', adminRoleId]
    )
    console.log('Admin user upserted:', email, `(${rowCount} row(s))`)
  } else {
    console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD to seed an admin user.')
  }

  await pool.end()
  console.log('Database initialized.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
