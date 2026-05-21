const { Router } = require('express');
const { query, queryOne, withTransaction, pool } = require('../db/database');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = Router();
router.use(requireAdmin);

// GET /api/admin/users — all users with AI usage stats
router.get('/users', async (req, res) => {
  try {
    const users = await query(`
      SELECT
        u.id, u.name, u.email, u.is_pro, u.is_admin, u.created_at,
        COALESCE(au.count, 0) AS ai_uses_this_month
      FROM users u
      LEFT JOIN ai_usage au
        ON au.user_id = u.id AND au.year_month = TO_CHAR(NOW(), 'YYYY-MM')
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/pro — toggle is_pro
router.patch('/users/:id/pro', async (req, res) => {
  try {
    const user = await queryOne(
      'UPDATE users SET is_pro = NOT is_pro WHERE id = $1 RETURNING id, name, email, is_pro',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id — delete user + all their data
router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await withTransaction(async (client) => {
      await client.query('DELETE FROM ai_usage WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM user_insights WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM user_expenses WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM user_goals WHERE user_id = $1', [targetId]);
      await client.query(
        'DELETE FROM plan_items WHERE payoff_plan_id IN (SELECT id FROM payoff_plans WHERE user_id = $1)',
        [targetId]
      );
      await client.query('DELETE FROM payoff_plans WHERE user_id = $1', [targetId]);
      await client.query(`
        DELETE FROM transactions WHERE account_id IN (
          SELECT a.id FROM accounts a
          JOIN plaid_items pi ON pi.id = a.plaid_item_id
          WHERE pi.user_id = $1
        )`, [targetId]);
      await client.query(`
        DELETE FROM credit_details WHERE account_id IN (
          SELECT a.id FROM accounts a
          JOIN plaid_items pi ON pi.id = a.plaid_item_id
          WHERE pi.user_id = $1
        )`, [targetId]);
      await client.query(`
        DELETE FROM accounts WHERE plaid_item_id IN (
          SELECT id FROM plaid_items WHERE user_id = $1
        )`, [targetId]);
      await client.query('DELETE FROM plaid_items WHERE user_id = $1', [targetId]);
      await client.query('DELETE FROM users WHERE id = $1', [targetId]);
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/health — system status check
router.get('/health', async (req, res) => {
  const checks = {};

  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  checks.plaid     = process.env.PLAID_CLIENT_ID    ? 'configured' : 'missing';
  checks.claude    = process.env.ANTHROPIC_API_KEY  ? 'configured' : 'missing';
  checks.supabase  = process.env.SUPABASE_URL        ? 'configured' : 'missing';

  res.json({
    status: checks.database === 'ok' ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
