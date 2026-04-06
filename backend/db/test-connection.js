/**
 * Quick check that DATABASE_URL reaches PostgreSQL.
 * Usage: node db/test-connection.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const pool = require('./pool')

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL in backend/.env')
    process.exit(1)
  }
  try {
    const { rows } = await pool.query(
      'SELECT current_database() AS db, current_user AS user, version() AS version'
    )
    const v = rows[0].version.split('\n')[0]
    console.log('Connected to PostgreSQL')
    console.log(`  database: ${rows[0].db}`)
    console.log(`  user:     ${rows[0].user}`)
    console.log(`  ${v}`)
  } catch (err) {
    console.error('Connection failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
