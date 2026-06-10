require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // ── Businesses ─────────────────────────────────────
    const biz = await db.query(`
      INSERT INTO businesses (name, email, phone, city, state, region, markup_pct, id_proof_1, id_proof_2, status)
      VALUES
        ('EduGroup International', 'partner@edugroup.com', '+1-555-0100', 'New York', 'NY', 'Northeast', 20, 'Aadhaar Card', 'PAN Card', 'active'),
        ('BrightFuture Schools',   'partner@brightfuture.com', '+1-555-0200', 'Los Angeles', 'CA', 'West Coast', 15, 'Voter ID', 'PAN Card', 'active'),
        ('AcademiaCorp',           'admin@academiacorp.com', '+1-555-0300', 'Chicago', 'IL', 'Midwest', 0, 'PAN Card', 'Aadhaar Card', 'inactive')
      RETURNING id, name
    `);
    const [biz1, biz2, biz3] = biz.rows;
    console.log('  ✓ Businesses seeded');

    // ── Schools ────────────────────────────────────────
    const schools = await db.query(`
      INSERT INTO schools (business_id, name, principal_name, email, phone, city, state, status)
      VALUES
        ($1, 'Sunshine Primary School',  'Dr. Jane Smith',    'info@sunshine.edu',  '+1-555-1001', 'New York',    'NY', 'active'),
        ($1, 'Riverside High School',    'Mr. R. Johnson',    'info@riverside.edu', '+1-555-1002', 'Brooklyn',    'NY', 'active'),
        ($1, 'Maple Leaf Academy',       'Dr. Alan Park',     'info@maple.edu',     '+1-555-1003', 'Queens',      'NY', 'pending'),
        ($2, 'Valley Academy',           'Ms. Emily Chen',    'info@valley.edu',    '+1-555-1004', 'Los Angeles', 'CA', 'active'),
        ($2, 'Horizon School',           'Mrs. Sara Lee',     'info@horizon.edu',   '+1-555-1005', 'Chicago',     'IL', 'active'),
        ($3, 'AcademiaCorp Primary',     'Mr. Tom Brown',     'info@acadpri.edu',   '+1-555-1006', 'Chicago',     'IL', 'inactive')
      RETURNING id, name
    `, [biz1.id, biz2.id, biz3.id]);
    const [s1, s2, s3, s4, s5, s6] = schools.rows;
    console.log('  ✓ Schools seeded');

    // ── Users (hash passwords) ─────────────────────────
    const hash = async (p) => bcrypt.hash(p, 12);
    await db.query(`
      INSERT INTO users (name, email, password_hash, phone, role, business_id, school_id, city, status)
      VALUES
        ('Super Administrator', 'admin@rajsuppliers.com',  $1, '+91-98765-00001', 'superadmin',     NULL,      NULL,  'HQ',          'active'),
        ('John Business',       'john@rajsuppliers.com',   $2, '+1-555-0101',     'business_admin', $5,        NULL,  'New York',    'active'),
        ('Sarah Administrator', 'sarah@rajsuppliers.com',  $3, '+1-555-0201',     'school_admin',   $5,        $7,    'New York',    'active'),
        ('Mike Staff',          'mike@rajsuppliers.com',   $4, '+1-555-0202',     'staff',          $5,        $7,    'New York',    'active'),
        ('Priya Sharma',        'priya@rajsuppliers.com',  $4, '+91-98765-00005', 'school_admin',   $6,        $8,    'Los Angeles', 'active'),
        ('Ravi Kumar',          'ravi@rajsuppliers.com',   $4, '+91-98765-00006', 'staff',          $6,        $8,    'Los Angeles', 'active')
    `, [
      await hash('admin123'),
      await hash('biz123'),
      await hash('school123'),
      await hash('staff123'),
      biz1.id, biz2.id,
      s1.id,   s4.id
    ]);
    console.log('  ✓ Users seeded');

    // ── Students ───────────────────────────────────────
    const students = await db.query(`
      INSERT INTO students (school_id, business_id, student_number, first_name, last_name, class_name, section, gender, parent_name, parent_phone, status)
      VALUES
        ($1, $7, '2024001', 'Alice',   'Johnson',  'Grade 5', 'A', 'Female', 'Mrs. Johnson',  '+1-555-2001', 'active'),
        ($1, $7, '2024002', 'Bob',     'Williams', 'Grade 5', 'B', 'Male',   'Mr. Williams',  '+1-555-2002', 'active'),
        ($2, $7, '2024003', 'Charlie', 'Brown',    'Grade 6', 'A', 'Male',   'Mrs. Brown',    '+1-555-2003', 'active'),
        ($4, $8, '2024004', 'David',   'Kim',      'Grade 4', 'A', 'Male',   'Mr. Kim',       '+1-555-2004', 'active'),
        ($3, $7, '2024005', 'Eva',     'Martinez', 'Grade 3', 'B', 'Female', 'Mrs. Martinez', '+1-555-2005', 'active'),
        ($2, $7, '2024006', 'Frank',   'Lee',      'Grade 7', 'A', 'Male',   'Mr. Lee',       '+1-555-2006', 'active'),
        ($1, $7, '2024007', 'Grace',   'Patel',    'Grade 2', 'B', 'Female', 'Ms. Patel',     '+1-555-2007', 'active')
      RETURNING id, student_number, school_id
    `, [s1.id, s2.id, s3.id, s4.id, s5.id, s6.id, biz1.id, biz2.id]);
    const stArr = students.rows;
    console.log('  ✓ Students seeded');

    // ── Global pricing (no business_id = global base) ──
    await db.query(`
      INSERT INTO pricing (business_id, product_type, tag_type, tag_size_mm, base_price, is_multicolour, is_global)
      VALUES
        (NULL,'pvc',     'sc', 12, 14, false, true),
        (NULL,'pvc',     'sc', 16, 18, false, true),
        (NULL,'pvc',     'mc', 12, 16, true,  true),
        (NULL,'pvc',     'mc', 16, 22, true,  true),
        (NULL,'pvc',     'mc', 20, 28, true,  true),
        (NULL,'sticker', 'sc', 12, 14, false, true),
        (NULL,'sticker', 'sc', 16, 18, false, true),
        (NULL,'sticker', 'mc', 12, 16, true,  true),
        (NULL,'sticker', 'mc', 16, 22, true,  true),
        (NULL,'sticker', 'mc', 20, 28, true,  true)
      ON CONFLICT DO NOTHING
    `);
    await db.query(`
      INSERT INTO pricing_addons (business_id, product_type, addon_key, addon_label, price, is_global)
      VALUES
        (NULL,'pvc',     'card',       'Card',              24, true),
        (NULL,'pvc',     'holder_reg', 'Holder Regular',    18, true),
        (NULL,'pvc',     'holder_pre', 'Holder Premium',    32, true),
        (NULL,'pvc',     'fitting',    'Fitting',            2, true),
        (NULL,'pvc',     'hook_s',     'Hook Small',         4, true),
        (NULL,'pvc',     'hook_l',     'Hook Large',         8, true),
        (NULL,'sticker', 'printing',   'Printing',          14, true),
        (NULL,'sticker', 'holder_reg', 'Holder Regular',    16, true),
        (NULL,'sticker', 'holder_pre', 'Holder Premium',    22, true),
        (NULL,'sticker', 'fitting',    'Fitting',            2, true),
        (NULL,'sticker', 'lamination', 'Lamination',         4, true),
        (NULL,'sticker', 'hook_s',     'Hook Small',         4, true),
        (NULL,'sticker', 'hook_l',     'Hook Large',         8, true)
      ON CONFLICT DO NOTHING
    `);
    console.log('  ✓ Pricing seeded');

    // ── ID Cards ───────────────────────────────────────
    const cards = await db.query(`
      INSERT INTO id_cards (card_number, student_id, school_id, business_id, product_type, valid_from, valid_until, status)
      VALUES
        ('SP0001', $1, $8,  $11, 'pvc',     '2025-01-01', '2025-12-31', 'active'),
        ('SP0002', $2, $8,  $11, 'pvc',     '2025-01-01', '2025-12-31', 'active'),
        ('RH0001', $3, $9,  $11, 'sticker', '2025-01-01', '2025-12-31', 'pending'),
        ('VA0001', $4, $10, $12, 'pvc',     '2025-01-01', '2025-12-31', 'active'),
        ('ML0001', $5, $8,  $11, 'sticker', '2025-01-01', '2025-12-31', 'revoked'),
        ('RH0002', $6, $9,  $11, 'pvc',     '2025-01-01', '2025-12-31', 'active')
      RETURNING id
    `, [...stArr.slice(0,6).map(s=>s.id), s1.id, s2.id, s4.id, biz1.id, biz2.id]);
    const cardArr = cards.rows;
    console.log('  ✓ ID Cards seeded');

    // ── Orders ─────────────────────────────────────────
    await db.query(`
      INSERT INTO orders (order_number, student_id, school_id, business_id, card_id, product_type, tag_type, tag_size_mm, is_multicolour, holder_type, has_fitting, quantity, unit_price, total_amount, payment_status, payment_method, payment_date, print_status)
      VALUES
        ('ORD-0041', $1, $8,  $12, $14, 'pvc',     'mc', 16, true,  'reg', true,  1, 44, 44,  'paid',    'UPI',  NOW()-INTERVAL '1 hour', 'ready'),
        ('ORD-0040', $2, $8,  $12, $15, 'pvc',     'sc', 12, false, NULL,  false, 1, 36, 36,  'pending', NULL,   NULL,                    'locked'),
        ('ORD-0039', $3, $9,  $12, $16, 'sticker', 'mc', 12, true,  'pre', false, 1, 42, 42,  'paid',    'Cash', NOW()-INTERVAL '3 hours', 'ready'),
        ('ORD-0038', $4, $10, $13, $17, 'pvc',     'sc', 16, false, NULL,  true,  1, 44, 44,  'paid',    'UPI',  NOW()-INTERVAL '1 day',  'done'),
        ('ORD-0037', $5, $8,  $12, NULL,'sticker', 'sc', 12, false, NULL,  false, 1, 32, 32,  'pending', NULL,   NULL,                    'locked'),
        ('ORD-0036', $6, $9,  $12, $18, 'pvc',     'mc', 20, true,  'pre', false, 1, 72, 72,  'paid',    'Cash', NOW()-INTERVAL '2 days', 'done')
    `, [
      ...stArr.slice(0,6).map(s=>s.id),
      s1.id, s2.id, s4.id,
      biz1.id, biz2.id,
      ...cardArr.map(c=>c.id)
    ]);
    console.log('  ✓ Orders seeded');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n🔑 Login credentials:');
    console.log('  Super Admin  : admin@rajsuppliers.com  / admin123');
    console.log('  Biz Admin    : john@rajsuppliers.com   / biz123');
    console.log('  School Admin : sarah@rajsuppliers.com  / school123');
    console.log('  Staff        : mike@rajsuppliers.com   / staff123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

seed();
