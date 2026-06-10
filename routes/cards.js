const router = require('express').Router();
const db = require('../db');
const { authenticate, isSchoolAdmin, isSuperAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    let q = `SELECT c.*,
      st.first_name||' '||st.last_name AS student_name,
      st.student_number, st.class_name,
      s.name AS school_name, b.name AS business_name
      FROM id_cards c
      JOIN students st ON st.id=c.student_id
      JOIN schools s ON s.id=c.school_id
      LEFT JOIN businesses b ON b.id=c.business_id WHERE 1=1`;
    const p = [];
    if (req.user.role==='business_admin'){q+=` AND c.business_id=$${p.length+1}`;p.push(req.user.business_id);}
    else if (req.user.role!=='superadmin'){q+=` AND c.school_id=$${p.length+1}`;p.push(req.user.school_id);}
    q += ' ORDER BY c.created_at DESC';
    const {rows} = await db.query(q,p);
    res.json(rows);
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/:id', authenticate, async (req,res) => {
  try {
    const {rows} = await db.query(
      `SELECT c.*,st.first_name||' '||st.last_name AS student_name,st.student_number,s.name AS school_name
       FROM id_cards c JOIN students st ON st.id=c.student_id JOIN schools s ON s.id=c.school_id WHERE c.id=$1`,
      [req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.post('/', authenticate, async (req,res) => {
  const {student_id,product_type,valid_until} = req.body;
  if(!student_id) return res.status(400).json({error:'student_id required'});
  try {
    const st = await db.query(`SELECT school_id,business_id,student_number FROM students WHERE id=$1`,[student_id]);
    if(!st.rows.length) return res.status(404).json({error:'Student not found'});
    const {school_id,business_id,student_number} = st.rows[0];
    const sc = await db.query(`SELECT name FROM schools WHERE id=$1`,[school_id]);
    const prefix = sc.rows[0]?.name?.split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase()||'ID';
    const cnt = await db.query(`SELECT COUNT(*) FROM id_cards WHERE school_id=$1`,[school_id]);
    const card_number = prefix+String(parseInt(cnt.rows[0].count)+1).padStart(4,'0');
    const {rows} = await db.query(`
      INSERT INTO id_cards (card_number,student_id,school_id,business_id,issued_by,product_type,valid_until,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING *`,
      [card_number,student_id,school_id,business_id,req.user.id,product_type||'pvc',valid_until||null]);
    res.status(201).json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.put('/:id/revoke', authenticate, isSchoolAdmin, async (req,res) => {
  try {
    const {rows} = await db.query(
      `UPDATE id_cards SET status='revoked',revoke_reason=$1,revoked_by=$2,revoked_at=NOW() WHERE id=$3 RETURNING *`,
      [req.body.reason||null,req.user.id,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.put('/:id/activate', authenticate, isSchoolAdmin, async (req,res) => {
  try {
    const {rows} = await db.query(
      `UPDATE id_cards SET status='active',revoke_reason=NULL,revoked_by=NULL,revoked_at=NULL WHERE id=$1 RETURNING *`,
      [req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.delete('/:id', authenticate, isSuperAdmin, async (req,res) => {
  try {
    await db.query(`DELETE FROM id_cards WHERE id=$1`,[req.params.id]);
    res.json({message:'Deleted'});
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
