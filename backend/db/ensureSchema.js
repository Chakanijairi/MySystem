const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const pool = require('./pool')

let ran = false

/**
 * Creates tables + roles + optional admin (from env). Idempotent (IF NOT EXISTS / upsert).
 * Runs on server start when AUTO_DB_SETUP is not 'false' (default: on).
 * Also used by: npm run db:init
 */
async function ensureSchema() {
  if (ran) return
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  /**
   * Older databases were created before `registration` and `recruited_by` existed.
   * `CREATE TABLE IF NOT EXISTS` is a no-op on an existing table, so the new
   * `CREATE INDEX ... ON users (recruited_by)` in schema.sql would crash with
   * "column does not exist" and abort the whole migration before our ALTERs
   * even ran. To stay robust, we:
   *   1) Run schema.sql but tolerate "column does not exist" errors so other
   *      statements still apply.
   *   2) Add any missing columns explicitly.
   *   3) Recreate any indexes that depended on the new columns.
   */
  try {
    await pool.query(sql)
  } catch (err) {
    if (err.code !== '42703') throw err
    console.warn('[db] schema.sql partial failure (missing column on legacy DB); patching…', err.message)
  }

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS registration JSONB NOT NULL DEFAULT '{}'::jsonb
  `)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS recruited_by UUID REFERENCES users (id) ON DELETE SET NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_recruited_by ON users (recruited_by)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      destination VARCHAR(255) NOT NULL,
      channel VARCHAR(20) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets (expires_at)
  `)

  // 'dealer' role was renamed to 'member'. Rename in place so the existing row
  // (and every FK in users.role_id) keeps working. Safe to run every boot:
  //   - if only 'dealer' exists  → it becomes 'member'
  //   - if both exist            → 'dealer' is collapsed into 'member' and removed
  //   - if only 'member' exists  → no-op
  await pool.query(`
    DO $$
    DECLARE
      dealer_id INT;
      member_id INT;
    BEGIN
      SELECT id INTO dealer_id FROM roles WHERE name = 'dealer';
      SELECT id INTO member_id FROM roles WHERE name = 'member';

      IF dealer_id IS NOT NULL AND member_id IS NULL THEN
        UPDATE roles SET name = 'member' WHERE id = dealer_id;
      ELSIF dealer_id IS NOT NULL AND member_id IS NOT NULL THEN
        UPDATE users SET role_id = member_id WHERE role_id = dealer_id;
        DELETE FROM roles WHERE id = dealer_id;
      END IF;
    END $$;
  `)

  await pool.query(`
    INSERT INTO roles (name) VALUES
      ('admin'),
      ('member'),
      ('manager'),
      ('director'),
      ('executive')
    ON CONFLICT (name) DO NOTHING
  `)

  // Extend roles with display metadata (builtin flag, badge color, description, etc.)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)
  `)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS access_level VARCHAR(50)
  `)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS color VARCHAR(20)
  `)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT
  `)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS builtin BOOLEAN NOT NULL DEFAULT FALSE
  `)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)
  await pool.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  // Per-role / per-feature permission flags. Value = 'full' | 'none' | 'partial:<note>'.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
      feature_key VARCHAR(64) NOT NULL,
      value VARCHAR(255) NOT NULL DEFAULT 'none',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role_id, feature_key)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id)
  `)

  // Audit log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users (id) ON DELETE SET NULL,
      user_label VARCHAR(255) NOT NULL,
      user_role VARCHAR(50),
      type VARCHAR(50) NOT NULL DEFAULT 'system',
      action VARCHAR(255) NOT NULL,
      detail TEXT,
      ip VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_events_at ON audit_events (created_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events (type)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events (user_id)
  `)

  // Promotions / bulletins
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promotions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'promotion',
      message TEXT NOT NULL DEFAULT '',
      start_date DATE,
      end_date DATE,
      visibility VARCHAR(50) NOT NULL DEFAULT 'all',
      banner_data_url TEXT,
      percent_off INTEGER,
      published BOOLEAN NOT NULL DEFAULT TRUE,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      manual_status VARCHAR(50),
      views INTEGER NOT NULL DEFAULT 0,
      sales_linked INTEGER NOT NULL DEFAULT 0,
      created_by UUID REFERENCES users (id) ON DELETE SET NULL,
      created_by_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_promotions_published ON promotions (published)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_promotions_archived ON promotions (archived)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_promotions_visibility ON promotions (visibility)
  `)

  // System settings (key/value)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(128) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID REFERENCES users (id) ON DELETE SET NULL
    )
  `)

  await seedRoleMetadata()
  await seedDefaultPermissions()
  await seedDefaultSettings()

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const fullName = (process.env.ADMIN_FULL_NAME || 'Shaw').trim()
  if (email && password) {
    const { rows: roles } = await pool.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    )
    if (!roles.length) {
      throw new Error('Admin role missing after roles seed')
    }
    const adminRoleId = roles[0].id
    const hash = await bcrypt.hash(String(password), 12)
    await pool.query(
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
    console.log('[db] Admin user ensured:', email)
  }

  ran = true
  console.log('[db] Schema ready (tables + roles).')
}

/**
 * Built-in role display metadata. Keyed by `roles.name`.
 * Values: display_name, access_level, color, description, builtin.
 */
const BUILTIN_ROLE_META = {
  admin: {
    display_name: 'Admin',
    access_level: 'Full Access',
    color: 'rose',
    description: 'All modules, settings, reports, role management',
  },
  executive: {
    display_name: 'Executive',
    access_level: 'Senior',
    color: 'rose',
    description: 'All operational modules, network oversight — no settings',
  },
  director: {
    display_name: 'Director',
    access_level: 'Senior',
    color: 'sky',
    description: 'Members, sales, Promotions, branch reports',
  },
  manager: {
    display_name: 'Manager',
    access_level: 'Elevated',
    color: 'amber',
    description: 'Members, sales, Promotions — no Settings',
  },
  member: {
    display_name: 'Member',
    access_level: 'Standard',
    color: 'violet',
    description: 'Own profile, Sales entry, View bulletins',
  },
}

/** Permission grid for each built-in role.
 *  Values: 'full' | 'none' | 'partial:<note>' */
const BUILTIN_PERMISSIONS = {
  admin: {
    dashboard: 'full',
    viewMembers: 'full',
    registerMembers: 'full',
    editMembers: 'full',
    activate: 'full',
    viewSales: 'full',
    recordSale: 'full',
    managePromotions: 'full',
    systemSettings: 'full',
  },
  executive: {
    dashboard: 'full',
    viewMembers: 'full',
    registerMembers: 'full',
    editMembers: 'full',
    activate: 'full',
    viewSales: 'full',
    recordSale: 'full',
    managePromotions: 'full',
    systemSettings: 'none',
  },
  director: {
    dashboard: 'full',
    viewMembers: 'full',
    registerMembers: 'full',
    editMembers: 'full',
    activate: 'full',
    viewSales: 'full',
    recordSale: 'full',
    managePromotions: 'full',
    systemSettings: 'none',
  },
  manager: {
    dashboard: 'full',
    viewMembers: 'full',
    registerMembers: 'full',
    editMembers: 'full',
    activate: 'full',
    viewSales: 'full',
    recordSale: 'full',
    managePromotions: 'full',
    systemSettings: 'none',
  },
  member: {
    dashboard: 'full',
    viewMembers: 'none',
    registerMembers: 'none',
    editMembers: 'partial:Own only',
    activate: 'none',
    viewSales: 'partial:Own only',
    recordSale: 'full',
    managePromotions: 'partial:View only',
    systemSettings: 'none',
  },
}

async function seedRoleMetadata() {
  for (const [name, meta] of Object.entries(BUILTIN_ROLE_META)) {
    // Set defaults for any built-in row that hasn't been customized yet
    // (display_name IS NULL means we've never seeded it). We don't clobber
    // admin-edited descriptions.
    await pool.query(
      `UPDATE roles
          SET display_name = COALESCE(display_name, $1),
              access_level = COALESCE(access_level, $2),
              color        = COALESCE(color, $3),
              description  = COALESCE(description, $4),
              builtin      = TRUE,
              updated_at   = NOW()
        WHERE name = $5`,
      [meta.display_name, meta.access_level, meta.color, meta.description, name]
    )
  }
}

async function seedDefaultPermissions() {
  const { rows } = await pool.query(
    `SELECT id, name FROM roles WHERE builtin = TRUE`
  )
  for (const role of rows) {
    const perms = BUILTIN_PERMISSIONS[role.name]
    if (!perms) continue
    for (const [feature_key, value] of Object.entries(perms)) {
      // Insert defaults but DO NOT clobber permissions an admin has already changed.
      await pool.query(
        `INSERT INTO role_permissions (role_id, feature_key, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, feature_key) DO NOTHING`,
        [role.id, feature_key, value]
      )
    }
  }
}

const DEFAULT_SETTINGS = {
  // Identity / branding
  'identity.systemName': 'Personal Collection',
  'identity.adminEmail': 'admin@personalcollection.ph',
  'identity.contactNumber': '',
  'identity.defaultPassword': '123',
  'identity.brandColor': '#CC0000',
  'identity.logoDataUrl': '',
  'identity.faviconDataUrl': '',
  // Security toggles
  'pref.requireDocumentVerification': true,
  'pref.memberSelfRegistration': false,
  'pref.emailAlertsForAdmins': true,
  'pref.maintenanceMode': false,
  'pref.showInventoryAges': true,
  'pref.requireStrongPasswords': false,
  'pref.autoLogoutInactivity': true,
  'pref.loginActivityAlerts': false,
  'pref.twoFactorAuth': false,
  // Notification toggles
  'pref.notifyNewMember': true,
  'pref.notifyNewSale': false,
  'pref.notifyAccountStatus': true,
  'pref.notifyWeeklySummary': false,
  'pref.notifyBulletinPublished': true,
  'pref.showNotificationBell': true,
  'pref.showRecentActivityFeed': true,
}

async function seedDefaultSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.query(
      `INSERT INTO system_settings (key, value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value)]
    )
  }
}

module.exports = { ensureSchema }
