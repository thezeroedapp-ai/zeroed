const jwt     = require('jsonwebtoken');
const { queryOne } = require('../db/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const authId  = decoded.sub;

    let user = await queryOne('SELECT * FROM users WHERE auth_id = $1', [authId]);

    if (!user) {
      // First request after OAuth signup — trigger may not have fired yet, create profile now
      user = await queryOne(`
        INSERT INTO users (auth_id, name, email)
        VALUES ($1, $2, $3)
        ON CONFLICT (auth_id) DO UPDATE SET email = EXCLUDED.email
        RETURNING *
      `, [
        authId,
        decoded.user_metadata?.name || decoded.user_metadata?.full_name || decoded.email?.split('@')[0] || 'User',
        decoded.email,
      ]);
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
