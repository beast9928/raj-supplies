const jwt = require('jsonwebtoken');
const db  = require('../db');

// ── Verify JWT and attach user ─────────────────────────
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      `SELECT id, name, email, role, business_id, school_id, status
       FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Role guard factory ─────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const isSuperAdmin    = requireRole('superadmin');
const isBusinessAdmin = requireRole('superadmin', 'business_admin');
const isSchoolAdmin   = requireRole('superadmin', 'business_admin', 'school_admin');
const isAnyStaff      = requireRole('superadmin', 'business_admin', 'school_admin', 'staff');

// ── Scope helper: limits queries to what role can see ─
function scopeFilter(user) {
  switch (user.role) {
    case 'superadmin':    return {};
    case 'business_admin': return { business_id: user.business_id };
    case 'school_admin':  return { school_id: user.school_id };
    case 'staff':         return { school_id: user.school_id };
    default:              return { id: null };
  }
}

module.exports = { authenticate, requireRole, isSuperAdmin, isBusinessAdmin, isSchoolAdmin, isAnyStaff, scopeFilter };
