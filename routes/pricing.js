const router = require('express').Router();
const db = require('../db');
const { authenticate, isBusinessAdmin, isSuperAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req,res) => {
  try {
    const bizId = req.user.role==='business_admin' ? req.user.business_id : req.query.business_id||null;
    const {rows: tags} = await db.query(
      `SELECT * FROM pricing WHERE (business_id=$1 OR (is_global=true AND business_id IS NULL)) ORDER BY product_type,tag_size_mm`,
      [bizId]);
    const {rows: addons} = await db.query(
      `SELECT * FROM pricing_addons WHERE (business_id=$1 OR (is_global=true AND business_id IS NULL)) ORDER BY product_type,addon_key`,
      [bizId]);
    res.json({tags, addons});
  } catch(e){res.status(500).json({error:e.message});}
});

router.put('/tags/:id', authenticate, isBusinessAdmin, async (req,res) => {
  const {base_price} = req.body;
  if(base_price===undefined) return res.status(400).json({error:'base_price required'});
  try {
    const {rows}=await db.query(
      `UPDATE pricing SET base_price=$1 WHERE id=$2 RETURNING *`,[base_price,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

router.put('/addons/:id', authenticate, isBusinessAdmin, async (req,res) => {
  const {price} = req.body;
  if(price===undefined) return res.status(400).json({error:'price required'});
  try {
    const {rows}=await db.query(
      `UPDATE pricing_addons SET price=$1 WHERE id=$2 RETURNING *`,[price,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Not found'});
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

// Bulk save all pricing
router.post('/save', authenticate, isBusinessAdmin, async (req,res) => {
  const {tags, addons} = req.body;
  try {
    if(tags) for(const t of tags){
      await db.query(`UPDATE pricing SET base_price=$1 WHERE id=$2`,[t.base_price,t.id]);
    }
    if(addons) for(const a of addons){
      await db.query(`UPDATE pricing_addons SET price=$1 WHERE id=$2`,[a.price,a.id]);
    }
    res.json({message:'Pricing saved'});
  } catch(e){res.status(500).json({error:e.message});}
});

// Reports / stats for dashboard
router.get('/reports/summary', authenticate, async (req,res) => {
  try {
    let w='WHERE 1=1'; const p=[];
    if(req.user.role==='business_admin'){w+=` AND o.business_id=$${p.length+1}`;p.push(req.user.business_id);}
    else if(req.user.role!=='superadmin'){w+=` AND o.school_id=$${p.length+1}`;p.push(req.user.school_id);}
    const {rows} = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM businesses ${req.user.role==='superadmin'?'':'WHERE id=$'+(p.length+1)}) AS businesses,
        (SELECT COUNT(*) FROM schools ${req.user.role==='superadmin'?'':'WHERE business_id=$'+(p.length+1)}) AS schools,
        (SELECT COUNT(*) FROM students ${req.user.role==='superadmin'?'':(req.user.role==='business_admin'?'WHERE business_id=$'+(p.length+1):'WHERE school_id=$'+(p.length+1))}) AS students,
        (SELECT COUNT(*) FROM id_cards ${req.user.role==='superadmin'?'':(req.user.role==='business_admin'?'WHERE business_id=$'+(p.length+1):'WHERE school_id=$'+(p.length+1))}) AS id_cards
    `, p.length ? [...p, req.user.role==='business_admin'?req.user.business_id:req.user.school_id] : []);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
