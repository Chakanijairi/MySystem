const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const pool = require('../db/pool')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

const uploadDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, WebP, or PDF files are allowed'))
  },
})

router.use(authenticate)

router.get('/sales', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, amount, commission_amount, sale_date, notes, created_at
       FROM sales WHERE dealer_id = $1
       ORDER BY sale_date DESC, created_at DESC`,
      [req.user.id]
    )
    return res.json({ sales: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load sales' })
  }
})

router.get('/installments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, sale_id, amount, due_date, paid_at, status, created_at
       FROM installments WHERE dealer_id = $1
       ORDER BY due_date DESC`,
      [req.user.id]
    )
    return res.json({ installments: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load installments' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { rows: docs } = await pool.query(
      `SELECT id, doc_type, verification_status, uploaded_at, reviewed_at, original_filename
       FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [req.user.id]
    )
    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name,
        phone: req.user.phone,
        role: req.user.role,
        account_status: req.user.account_status,
        member_category: req.user.member_category,
      },
      documents: docs,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load profile' })
  }
})

router.post('/documents', upload.fields([
  { name: 'national_id', maxCount: 1 },
  { name: 'utility_bill', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files || {}
    const idFile = files.national_id?.[0]
    const utilFile = files.utility_bill?.[0]
    if (!idFile || !utilFile) {
      return res.status(400).json({
        error: 'Both national_id and utility_bill files are required',
      })
    }

    const upsert = async (file, docType) => {
      const rel = path.basename(file.path)
      await pool.query(
        `INSERT INTO documents (user_id, doc_type, storage_path, original_filename, mime_type, verification_status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (user_id, doc_type) DO UPDATE SET
           storage_path = EXCLUDED.storage_path,
           original_filename = EXCLUDED.original_filename,
           mime_type = EXCLUDED.mime_type,
           verification_status = 'pending',
           reviewed_at = NULL,
           reviewed_by = NULL,
           uploaded_at = NOW()`,
        [
          req.user.id,
          docType,
          rel,
          file.originalname,
          file.mimetype,
        ]
      )
    }

    await upsert(idFile, 'national_id')
    await upsert(utilFile, 'utility_bill')

    return res.json({ message: 'Documents uploaded. An administrator will review them.' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

module.exports = router
