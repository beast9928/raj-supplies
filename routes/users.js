/* users.js */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, isSuperAdmin, isBusinessAdmin, isSchoolAdmin } = require('../middleware/auth');

router.get('/', authenticate, isSchoolAdmin, async (req,res) => {
  try {
    let q=`SELECT u.id,u.name,u.email,u.role,u.phone,u.city,u.status,u.last_login,u.created_at,
      b.name AS business_name, s.name AS school_name
      FROM users u LEFT JOIN businesses b ON b.id=u.business_id LEFT JOIN schools s ON s.id=u.school_id WHERE 1=1`;
    const p=[];
    if(req.user.role==='business_admin'){q+=` AND u.business_id=$${p.length+1}`;p.push(req.user.business_id);}
    else if(req.user.role==='school_admin'){q+=` AND u.school_id=$${p.length+1}`;p.push(req.user.school_id);}
    q+=' ORDER BY u.created_at DESC';
    const {rows}=await db.query(q,p);
    res.json(rows);
  } catch(e){res.status(500).json({error:e.message});}
});

router.post('/', authenticate, isSchoolAdmin, async (req,res) => {
  const {name,email,password,phone,role,business_id,school_id,city}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:'name,email,password required'});
  const allowedRoles={superadmin:[],business_admin:['school_admin','staff'],school_admin:['staff']};
  if(req.user.role!=='superadmin'&&!allowedRoles[req.user.role]?.includes(role))
    return res.status(403).json({error:'Cannot assign this role'});
  try {
    const hash=await bcrypt.hash(password,12);
    const bId=req.user.role==='business_admin'?req.user.business_id:business_id||null;
    const sId=req.user.role==='school_admin'?req.user.school_id:school_id||null;
    const {rows}=await db.query(
      `INSERT INTO users (name,email,password_hash,phone,role,business_id,school_id,city) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,email,role,status`,
      [name,email,hash,phone||null,role||'staff',bId,sId,city||null]);
    res.status(201).json(rows[0]);
  } catch(e){
    if(e.code==='23505') return res.status(409).json({error:'Email already exists'});
    res.status(500).json({error:e.message});
  }
});

router.put('/:id', authenticate, isSchoolAdmin, async (req,res) => {
  const {name,phone,city,status,school_id,business_id}=req.body;
  try {
    const {rows}=await db.query(
      `UPDATE users SET name=COALESCE($1,name),phone=COALESCE($2,phone),city=COALESCE($3,city),
       status=COALESCE($4,status),school_id=COALESCE($5,school_id),business_id=COALESCE($6,business_id)
       WHERE id=$7 RETURNING id,name,email,role,phone,city,status`,
      [name,phone,city,status,school_id||null,business_id||null,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.delete('/:id', authenticate, isSuperAdmin, async (req,res) => {
  if(req.params.id===req.user.id) return res.status(400).json({error:'Cannot delete yourself'});
  try {
    await db.query(`DELETE FROM users WHERE id=$1`,[req.params.id]);
    res.json({message:'Deleted'});
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
