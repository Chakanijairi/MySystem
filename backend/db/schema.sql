-- Personal Collection Dealer Monitoring System — PostgreSQL schema
-- Supabase uses PG15+: gen_random_uuid() is built in.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  access_level VARCHAR(50),
  color VARCHAR(20),
  description TEXT,
  builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-role / per-feature permission flag.
-- value = 'full' | 'none' | 'partial:<note>'
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  feature_key VARCHAR(64) NOT NULL,
  value VARCHAR(255) NOT NULL DEFAULT 'none',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles (id),
  account_status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  member_category VARCHAR(100),
  registration JSONB NOT NULL DEFAULT '{}'::jsonb,
  recruited_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (account_status);
CREATE INDEX IF NOT EXISTS idx_users_recruited_by ON users (recruited_by);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users (id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES users (id),
  amount DECIMAL(14, 2) NOT NULL,
  commission_amount DECIMAL(14, 2),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_dealer ON sales (dealer_id);

CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES users (id),
  sale_id UUID REFERENCES sales (id) ON DELETE SET NULL,
  amount DECIMAL(14, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_dealer ON installments (dealer_id);

-- Audit log of admin / system events
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
);
CREATE INDEX IF NOT EXISTS idx_audit_events_at ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events (type);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events (user_id);

-- Promotions / bulletins published to the dealer portal
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
);
CREATE INDEX IF NOT EXISTS idx_promotions_published ON promotions (published);
CREATE INDEX IF NOT EXISTS idx_promotions_archived ON promotions (archived);
CREATE INDEX IF NOT EXISTS idx_promotions_visibility ON promotions (visibility);

-- Key/value system settings (admin identity, security toggles, notifications)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(128) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL
);

-- Account recovery: short-lived OTP codes used by forgot-password flow
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
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets (expires_at);
