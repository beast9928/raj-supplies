const router = require('express').Router();
const db = require('../db');
const { authenticate, isSchoolAdmin, isSuperAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    let q = `SELECT o.*,
      st.first_name||' '||st.last_name AS student_name, st.student_number,
      s.name AS school_name, b.name AS business_name,
      u.name AS created_by_name
      FROM orders o
      JOIN students st ON st.id=o.student_id
      JOIN schools s ON s.id=o.school_id
      LEFT JOIN businesses b ON b.id=o.business_id
      LEFT JOIN users u ON u.id=o.created_by
      WHERE 1=1`;
    const p = [];
    if (req.user.role==='business_admin'){q+=` AND o.business_id=$${p.length+1}`;p.push(req.user.business_id);}
    else if (req.user.role!=='superadmin'){q+=` AND o.school_id=$${p.length+1}`;p.push(req.user.school_id);}
    if (req.query.payment_status){q+=` AND o.payment_status=$${p.length+1}`;p.push(req.query.payment_status);}
    if (req.query.print_status){q+=` AND o.print_status=$${p.length+1}`;p.push(req.query.print_status);}
    q += ' ORDER BY o.created_at DESC';
    if (req.query.limit){q+=` LIMIT $${p.length+1}`;p.push(parseInt(req.query.limit));}
    const {rows} = await db.query(q,p);
    res.json(rows);
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    let w='WHERE 1=1'; const p=[];
    if (req.user.role==='business_admin'){w+=` AND o.business_id=$${p.length+1}`;p.push(req.user.business_id);}
    else if (req.user.role!=='superadmin'){w+=` AND o.school_id=$${p.length+1}`;p.push(req.user.school_id);}
    const {rows} = await db.query(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(total_amount) AS total_revenue,
        SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END) AS paid_revenue,
        SUM(CASE WHEN payment_status='pending' THEN 1 ELSE 0 END) AS pending_payment_count,
        SUM(CASE WHEN print_status='ready' THEN 1 ELSE 0 END) AS ready_to_print,
        SUM(CASE WHEN DATE(created_at)=CURRENT_DATE THEN 1 ELSE 0 END) AS today_orders,
        SUM(CASE WHEN DATE(created_at)=CURRENT_DATE AND payment_status='paid' THEN total_amount ELSE 0 END) AS today_revenue
      FROM orders o ${w}`, p);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.get('/:id', authenticate, async (req,res) => {
  try {
    const {rows} = await db.query(
      `SELECT o.*,st.first_name||' '||st.last_name AS student_name,s.name AS school_name
       FROM orders o JOIN students st ON st.id=o.student_id JOIN schools s ON s.id=o.school_id WHERE o.id=$1`,
      [req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.post('/', authenticate, async (req,res) => {
  const {student_id,school_id,product_type,tag_type,tag_size_mm,is_multicolour,holder_type,hook_size,has_fitting,has_lamination,quantity,unit_price,total_amount,payment_method,notes} = req.body;
  if(!student_id||!school_id||!product_type) return res.status(400).json({error:'student_id,school_id,product_type required'});
  try {
    const sc = await db.query(`SELECT business_id FROM schools WHERE id=$1`,[school_id]);
    const business_id = sc.rows[0]?.business_id || req.user.business_id;
    const cnt = await db.query(`SELECT COUNT(*) FROM orders`);
    const order_number = 'ORD-'+String(parseInt(cnt.rows[0].count)+1).padStart(4,'0');
    const {rows} = await db.query(`
      INSERT INTO orders (order_number,student_id,school_id,business_id,created_by,product_type,tag_type,tag_size_mm,is_multicolour,holder_type,hook_size,has_fitting,has_lamination,quantity,unit_price,total_amount,payment_method,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [order_number,student_id,school_id,business_id,req.user.id,product_type,tag_type||null,tag_size_mm||null,is_multicolour||false,holder_type||null,hook_size||null,has_fitting||false,has_lamination||false,quantity||1,unit_price||0,total_amount||0,payment_method||null,notes||null]);
    res.status(201).json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

// Mark payment received — unlocks print
router.put('/:id/pay', authenticate, async (req,res) => {
  const {payment_method,payment_ref} = req.body;
  try {
    const {rows} = await db.query(`
      UPDATE orders SET payment_status='paid',payment_method=COALESCE($1,payment_method),
        payment_ref=$2,payment_date=NOW(),print_status='ready'
      WHERE id=$3 RETURNING *`,
      [payment_method,payment_ref||null,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

// Mark as printed
router.put('/:id/print', authenticate, async (req,res) => {
  try {
    const chk = await db.query(`SELECT print_status,payment_status FROM orders WHERE id=$1`,[req.params.id]);
    if(!chk.rows.length) return res.status(404).json({error:'Not found'});
    if(chk.rows[0].payment_status!=='paid') return res.status(400).json({error:'Payment required before printing'});
    const {rows} = await db.query(
      `UPDATE orders SET print_status='done',print_date=NOW() WHERE id=$1 RETURNING *`,[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.delete('/:id', authenticate, isSuperAdmin, async (req,res) => {
  try {
    await db.query(`DELETE FROM orders WHERE id=$1`,[req.params.id]);
    res.json({message:'Deleted'});
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
