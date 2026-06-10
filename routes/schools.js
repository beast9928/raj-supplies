const router = require('express').Router();
const db = require('../db');
const { authenticate, isSuperAdmin, isBusinessAdmin, isSchoolAdmin } = require('../middleware/auth');

function scopeWhere(user) {
  if (user.role === 'superadmin') return { sql: '', params: [] };
  if (user.role === 'business_admin') return { sql: ' AND s.business_id=$', params: [user.business_id] };
  return { sql: ' AND s.id=$', params: [user.school_id] };
}

router.get('/', authenticate, async (req, res) => {
  try {
    let q = `SELECT s.*, b.name AS business_name,
      COUNT(DISTINCT st.id) AS student_count
      FROM schools s
      LEFT JOIN businesses b ON b.id = s.business_id
      LEFT JOIN students st ON st.school_id = s.id
      WHERE 1=1`;
    const params = [];
    if (req.user.role === 'business_admin') { q += ` AND s.business_id=$${params.length+1}`; params.push(req.user.business_id); }
    else if (req.user.role !== 'superadmin') { q += ` AND s.id=$${params.length+1}`; params.push(req.user.school_id); }
    q += ' GROUP BY s.id, b.name ORDER BY s.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, b.name AS business_name FROM schools s LEFT JOIN businesses b ON b.id=s.business_id WHERE s.id=$1`,
      [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, isBusinessAdmin, async (req, res) => {
  const { name, business_id, principal_name, email, phone, city, state, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const bizId = req.user.role === 'business_admin' ? req.user.business_id : business_id;
  try {
    const { rows } = await db.query(`
      INSERT INTO schools (name,business_id,principal_name,email,phone,city,state,address,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING *`,
      [name,bizId,principal_name,email,phone,city,state,address]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, isBusinessAdmin, async (req, res) => {
  const { name, principal_name, email, phone, city, state, status } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE schools SET name=COALESCE($1,name), principal_name=COALESCE($2,principal_name),
        email=COALESCE($3,email), phone=COALESCE($4,phone), city=COALESCE($5,city),
        state=COALESCE($6,state), status=COALESCE($7,status) WHERE id=$8 RETURNING *`,
      [name,principal_name,email,phone,city,state,status,req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, isSuperAdmin, async (req, res) => {
  try {
    await db.query(`DELETE FROM schools WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
