const { Router } = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = Router();
router.use(requireAdmin);

// GET /api/admin/users — all users with AI usage stats
router.get('/users', async (req, res) => {
  try {
    const ym    = new Date().toISOString().slice(0, 7);
    const users = await db.getAllUsers();

    const withUsage = await Promise.all(users.map(async u => {
      const usage = await db.getUsage(u.uid, ym);
      return { ...u, id: u.uid, ai_uses_this_month: usage?.count || 0 };
    }));

    withUsage.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    res.json(withUsage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:uid/pro — toggle is_pro
router.patch('/users/:uid/pro', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await db.getUser(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updated = await db.upsertUser(uid, { is_pro: !user.is_pro });
    res.json({ uid, id: uid, name: updated.name, email: updated.email, is_pro: updated.is_pro });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:uid — delete user + all their data
router.delete('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    if (uid === req.user.uid) return res.status(400).json({ error: 'Cannot delete your own account' });

    await db.deleteUserData(uid);
    try { await db.admin.auth().deleteUser(uid); } catch { /* auth user may not exist */ }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/health — system status
router.get('/health', async (req, res) => {
  const checks = {};

  try {
    await db.firestore.collection('users').limit(1).get();
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  checks.plaid    = process.env.PLAID_CLIENT_ID   ? 'configured' : 'missing';
  checks.claude   = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
  checks.firebase = (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS)
    ? 'configured' : 'runtime';

  res.json({
    status:    checks.database === 'ok' ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
