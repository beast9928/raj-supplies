const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db      = require('../db');
const { authenticate } = require('../middleware/auth');

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const { rows } = await db.query(
        `SELECT id, name, email, password_hash, role, business_id, school_id, status
         FROM users WHERE email = $1`, [email]
      );
      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Account is not active' });
      }

      await db.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

      // Fetch related names for context
      let businessName = null, schoolName = null;
      if (user.business_id) {
        const b = await db.query(`SELECT name FROM businesses WHERE id = $1`, [user.business_id]);
        businessName = b.rows[0]?.name;
      }
      if (user.school_id) {
        const s = await db.query(`SELECT name FROM schools WHERE id = $1`, [user.school_id]);
        schoolName = s.rows[0]?.name;
      }

      const token = signToken(user.id);
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          business_id: user.business_id,
          business_name: businessName,
          school_id: user.school_id,
          school_name: schoolName,
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.city,
              u.business_id, b.name AS business_name,
              u.school_id,   s.name AS school_name,
              u.status, u.last_login, u.created_at
       FROM users u
       LEFT JOIN businesses b ON b.id = u.business_id
       LEFT JOIN schools    s ON s.id = u.school_id
       WHERE u.id = $1`, [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/password
router.put('/password', authenticate,
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { current_password, new_password } = req.body;
    try {
      const { rows } = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
      if (!(await bcrypt.compare(current_password, rows[0].password_hash))) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      const hash = await bcrypt.hash(new_password, 12);
      await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.id]);
      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/auth/profile
router.put('/profile', authenticate,
  body('name').notEmpty().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, phone, city } = req.body;
    try {
      const { rows } = await db.query(
        `UPDATE users SET name=$1, phone=$2, city=$3 WHERE id=$4 RETURNING id,name,email,phone,city`,
        [name, phone || null, city || null, req.user.id]
      );
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
