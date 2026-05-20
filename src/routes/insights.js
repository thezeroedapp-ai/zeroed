const express  = require('express');
const router   = express.Router();
const { getDb, getLatestInsight, saveInsight, getUsage, incrementUsage, getExpenses } = require('../db/database');
const { getSpendingInsight } = require('../services/claudeService');

const FREE_LIMIT = 10;

function yearMonth() {
  return new Date().toISOString().slice(0, 7);
}

function usageStats(user, used) {
  return {
    used,
    limit:     user.is_pro ? null : FREE_LIMIT,
    remaining: user.is_pro ? null : Math.max(0, FREE_LIMIT - used),
    isPro:     !!user.is_pro,
  };
}

// GET /api/insights/latest
router.get('/latest', (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    if (!user) return res.status(400).json({ error: 'User not found' });

    const insight = getLatestInsight(1);
    const used    = getUsage(1, yearMonth())?.count || 0;

    res.json({ insight: insight || null, ...usageStats(user, used) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/insights/generate
router.post('/generate', async (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    if (!user) return res.status(400).json({ error: 'User not found' });

    const ym   = yearMonth();
    const used = getUsage(1, ym)?.count || 0;

    if (!user.is_pro && used >= FREE_LIMIT) {
      return res.status(429).json({
        ...usageStats(user, used),
        error: `You've used all ${FREE_LIMIT} free AI analyses this month. Contact us to upgrade to Pro.`,
      });
    }

    const accounts = db.prepare(`
      SELECT a.*, cd.apr, cd.minimum_payment
      FROM accounts a
      LEFT JOIN credit_details cd ON cd.account_id = a.id
      WHERE a.type = 'credit'
    `).all();

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const txRows = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE date >= ? AND amount > 0
      GROUP BY category
      ORDER BY total DESC
    `).all(since.toISOString().split('T')[0]);

    const spendingByCategory = Object.fromEntries(
      txRows.filter(r => r.category).map(r => [r.category, r.total])
    );

    const totalDebt      = accounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const monthlyInterest= accounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
    const totalMin       = accounts.reduce((s, a) => s + (a.minimum_payment || 0), 0);
    const sinkingTotal   = getExpenses(1).reduce((s, e) => s + e.amount, 0);
    const surplus        = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin - sinkingTotal;

    const insightText = await getSpendingInsight(
      user, accounts, spendingByCategory, totalDebt, monthlyInterest, surplus
    );

    incrementUsage(1, ym);
    const saved    = saveInsight(1, insightText);
    const newUsed  = used + 1;

    res.json({ insight: saved, ...usageStats(user, newUsed) });
  } catch (err) {
    console.error('[insights/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
