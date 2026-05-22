const db = require('../db/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await db.admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    let user = await db.getUser(uid);
    if (!user) {
      user = await db.upsertUser(uid, {
        name:             decoded.name || decoded.email?.split('@')[0] || 'User',
        email:            decoded.email || '',
        is_pro:           false,
        is_admin:         false,
        monthly_income:   null,
        monthly_expenses: null,
        strategy:         'avalanche',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] verifyIdToken failed:', err.code, err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
