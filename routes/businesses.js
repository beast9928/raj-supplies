const router = require('express').Router();
const db = require('../db');
const { authenticate, isSuperAdmin, isBusinessAdmin, scopeFilter } = require('../middleware/auth');

// ── GET all businesses (superadmin only) ──────────────
router.get('/', authenticate, isSuperAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.*,
        COUNT(DISTINCT s.id) AS school_count,
        COUNT(DISTINCT st.id) AS student_count
      FROM businesses b
      LEFT JOIN schools s ON s.business_id = b.id
      LEFT JOIN students st ON st.business_id = b.id
      GROUP BY b.id ORDER BY b.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET single business ───────────────────────────────
router.get('/:id', authenticate, isBusinessAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM businesses WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'business_admin' && rows[0].id !== req.user.business_id)
      return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST create business ──────────────────────────────
router.post('/', authenticate, isSuperAdmin, async (req, res) => {
  const { name, email, phone, city, state, region, markup_pct, id_proof_1, id_proof_2 } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO businesses (name,email,phone,city,state,region,markup_pct,id_proof_1,id_proof_2,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active') RETURNING *
    `, [name, email, phone, city, state, region, markup_pct||0, id_proof_1, id_proof_2]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── PUT update business ───────────────────────────────
router.put('/:id', authenticate, isBusinessAdmin, async (req, res) => {
  const { name, email, phone, city, state, region, markup_pct, status } = req.body;
  if (req.user.role === 'business_admin' && req.params.id !== req.user.business_id)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await db.query(`
      UPDATE businesses SET name=COALESCE($1,name), email=COALESCE($2,email),
        phone=COALESCE($3,phone), city=COALESCE($4,city), state=COALESCE($5,state),
        region=COALESCE($6,region), markup_pct=COALESCE($7,markup_pct),
        status=COALESCE($8,status) WHERE id=$9 RETURNING *
    `, [name,email,phone,city,state,region,markup_pct,status,req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE business ───────────────────────────────────
router.delete('/:id', authenticate, isSuperAdmin, async (req, res) => {
  try {
    await db.query(`DELETE FROM businesses WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
