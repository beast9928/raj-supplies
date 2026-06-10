require('dotenv').config();
const db = require('./index');

const schema = `

-- ── Extensions ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drop tables in reverse dependency order ───────────
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS id_cards CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS schools CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- ── ENUM types ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('superadmin','business_admin','school_admin','staff');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('active','inactive','pending','suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE card_status AS ENUM ('active','pending','revoked','expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_payment_status AS ENUM ('paid','pending','failed','refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_print_status AS ENUM ('locked','ready','printing','done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('pvc','sticker');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── BUSINESSES ─────────────────────────────────────────
CREATE TABLE businesses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  phone         VARCHAR(30),
  city          VARCHAR(100),
  state         VARCHAR(100),
  region        VARCHAR(100),
  markup_pct    NUMERIC(5,2) DEFAULT 0 CHECK (markup_pct >= 0 AND markup_pct <= 35),
  id_proof_1    VARCHAR(50),
  id_proof_2    VARCHAR(50),
  logo_url      TEXT,
  status        entity_status DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SCHOOLS ────────────────────────────────────────────
CREATE TABLE schools (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID REFERENCES businesses(id) ON DELETE SET NULL,
  name            VARCHAR(200) NOT NULL,
  principal_name  VARCHAR(150),
  email           VARCHAR(200),
  phone           VARCHAR(30),
  city            VARCHAR(100),
  state           VARCHAR(100),
  address         TEXT,
  logo_url        TEXT,
  status          entity_status DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS ──────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(200) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  phone           VARCHAR(30),
  role            user_role NOT NULL DEFAULT 'staff',
  business_id     UUID REFERENCES businesses(id) ON DELETE SET NULL,
  school_id       UUID REFERENCES schools(id) ON DELETE SET NULL,
  city            VARCHAR(100),
  state           VARCHAR(100),
  status          entity_status DEFAULT 'active',
  last_login      TIMESTAMPTZ,
  reset_token     TEXT,
  reset_expires   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── STUDENTS ───────────────────────────────────────────
CREATE TABLE students (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  business_id     UUID REFERENCES businesses(id) ON DELETE SET NULL,
  student_number  VARCHAR(50) UNIQUE NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  class_name      VARCHAR(100),
  section         VARCHAR(20),
  date_of_birth   DATE,
  gender          VARCHAR(20),
  parent_name     VARCHAR(150),
  parent_phone    VARCHAR(30),
  parent_email    VARCHAR(200),
  photo_url       TEXT,
  address         TEXT,
  status          entity_status DEFAULT 'active',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRICING ────────────────────────────────────────────
CREATE TABLE pricing (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID REFERENCES businesses(id) ON DELETE CASCADE,
  product_type    product_type NOT NULL,
  tag_type        VARCHAR(30) NOT NULL,
  tag_size_mm     INTEGER,
  base_price      NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_multicolour  BOOLEAN DEFAULT FALSE,
  is_global       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, product_type, tag_type)
);

CREATE TABLE pricing_addons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID REFERENCES businesses(id) ON DELETE CASCADE,
  product_type    product_type NOT NULL,
  addon_key       VARCHAR(50) NOT NULL,
  addon_label     VARCHAR(100) NOT NULL,
  price           NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_global       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, product_type, addon_key)
);

-- ── ID CARDS ───────────────────────────────────────────
CREATE TABLE id_cards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_number     VARCHAR(30) UNIQUE NOT NULL,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id),
  business_id     UUID REFERENCES businesses(id),
  issued_by       UUID REFERENCES users(id),
  product_type    product_type DEFAULT 'pvc',
  valid_from      DATE DEFAULT CURRENT_DATE,
  valid_until     DATE,
  status          card_status DEFAULT 'pending',
  revoke_reason   TEXT,
  revoked_by      UUID REFERENCES users(id),
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ORDERS ─────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    VARCHAR(20) UNIQUE NOT NULL,
  student_id      UUID NOT NULL REFERENCES students(id),
  school_id       UUID NOT NULL REFERENCES schools(id),
  business_id     UUID REFERENCES businesses(id),
  card_id         UUID REFERENCES id_cards(id),
  created_by      UUID REFERENCES users(id),
  product_type    product_type NOT NULL,
  tag_type        VARCHAR(30),
  tag_size_mm     INTEGER,
  is_multicolour  BOOLEAN DEFAULT FALSE,
  holder_type     VARCHAR(20),
  hook_size       VARCHAR(10),
  has_fitting     BOOLEAN DEFAULT FALSE,
  has_lamination  BOOLEAN DEFAULT FALSE,
  quantity        INTEGER DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status  order_payment_status DEFAULT 'pending',
  payment_method  VARCHAR(50),
  payment_ref     VARCHAR(100),
  payment_date    TIMESTAMPTZ,
  print_status    order_print_status DEFAULT 'locked',
  print_date      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACTIVITY LOGS ──────────────────────────────────────
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  details     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────
CREATE INDEX idx_schools_business ON schools(business_id);
CREATE INDEX idx_users_business ON users(business_id);
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_number ON students(student_number);
CREATE INDEX idx_cards_student ON id_cards(student_id);
CREATE INDEX idx_cards_number ON id_cards(card_number);
CREATE INDEX idx_orders_student ON orders(student_id);
CREATE INDEX idx_orders_school ON orders(school_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_payment ON orders(payment_status);
CREATE INDEX idx_orders_print ON orders(print_status);
CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at DESC);

-- ── AUTO-UPDATE updated_at ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['businesses','schools','users','students','id_cards','orders','pricing','pricing_addons'])
LOOP EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
END LOOP; END $$;
`;

async function migrate() {
  console.log('🔧 Running database migration...');
  try {
    await db.query(schema);
    console.log('✅ Schema created successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
