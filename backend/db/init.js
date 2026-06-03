require('dotenv').config()
const pool = require('./pool')
const { ensureSchema } = require('./ensureSchema')

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Set DATABASE_URL in backend/.env')
    process.exit(1)
  }

  await ensureSchema()

  await pool.end()
  console.log('Database initialized.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
