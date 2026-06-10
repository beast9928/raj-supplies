/* students.js */
const router = require('express').Router();
const db = require('../db');
const { authenticate, isSchoolAdmin, isSuperAdmin, isBusinessAdmin } = require('../middleware/auth');

function scope(user, alias='st') {
  if (user.role==='superadmin') return {w:'',p:[]};
  if (user.role==='business_admin') return {w:` AND ${alias}.business_id=$`,p:[user.business_id]};
  return {w:` AND ${alias}.school_id=$`,p:[user.school_id]};
}

router.get('/', authenticate, async (req, res) => {
  try {
    const sc = scope(req.user);
    const pidx = sc.p.length ? sc.p.length : 0;
    const { rows } = await db.query(
      `SELECT st.*, s.name AS school_name, b.name AS business_name
       FROM students st
       LEFT JOIN schools s ON s.id=st.school_id
       LEFT JOIN businesses b ON b.id=st.business_id
       WHERE 1=1${sc.w.replace('$','$'+(pidx+1))}
       ORDER BY st.created_at DESC`, sc.p);
    res.json(rows);
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/:id', authenticate, async (req,res) => {
  try {
    const {rows} = await db.query(
      `SELECT st.*,s.name AS school_name FROM students st LEFT JOIN schools s ON s.id=st.school_id WHERE st.id=$1`,
      [req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.post('/', authenticate, async (req, res) => {
  const {school_id,first_name,last_name,class_name,section,gender,date_of_birth,parent_name,parent_phone,parent_email,address} = req.body;
  if(!first_name||!last_name||!school_id) return res.status(400).json({error:'first_name, last_name, school_id required'});
  try {
    const sc = await db.query(`SELECT business_id FROM schools WHERE id=$1`,[school_id]);
    const business_id = sc.rows[0]?.business_id;
    const cnt = await db.query(`SELECT COUNT(*) FROM students`);
    const num = 'STU'+String(parseInt(cnt.rows[0].count)+1).padStart(5,'0');
    const {rows} = await db.query(`
      INSERT INTO students (school_id,business_id,student_number,first_name,last_name,class_name,section,gender,date_of_birth,parent_name,parent_phone,parent_email,address,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [school_id,business_id,num,first_name,last_name,class_name,section,gender,date_of_birth||null,parent_name,parent_phone,parent_email,address,req.user.id]);
    res.status(201).json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.put('/:id', authenticate, async (req,res) => {
  const {first_name,last_name,class_name,section,gender,date_of_birth,parent_name,parent_phone,parent_email,address,status} = req.body;
  try {
    const {rows} = await db.query(`
      UPDATE students SET first_name=COALESCE($1,first_name),last_name=COALESCE($2,last_name),
        class_name=COALESCE($3,class_name),section=COALESCE($4,section),gender=COALESCE($5,gender),
        date_of_birth=COALESCE($6,date_of_birth),parent_name=COALESCE($7,parent_name),
        parent_phone=COALESCE($8,parent_phone),parent_email=COALESCE($9,parent_email),
        address=COALESCE($10,address),status=COALESCE($11,status) WHERE id=$12 RETURNING *`,
      [first_name,last_name,class_name,section,gender,date_of_birth||null,parent_name,parent_phone,parent_email,address,status,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.delete('/:id', authenticate, isSchoolAdmin, async (req,res) => {
  try {
    await db.query(`DELETE FROM students WHERE id=$1`,[req.params.id]);
    res.json({message:'Deleted'});
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
