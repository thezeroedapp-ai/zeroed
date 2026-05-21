const express  = require('express');
const router   = express.Router();
const { query, queryOne, getLatestInsight, saveInsight, getUsage, incrementUsage, getExpenses } = require('../db/database');
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
router.get('/latest', async (req, res) => {
  try {
    const user    = req.user;
    const insight = await getLatestInsight(user.id);
    const used    = (await getUsage(user.id, yearMonth()))?.count || 0;
    res.json({ insight: insight || null, ...usageStats(user, used) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/insights/generate
router.post('/generate', async (req, res) => {
  try {
    const user = req.user;
    const ym   = yearMonth();
    const used = (await getUsage(user.id, ym))?.count || 0;

    if (!user.is_pro && used >= FREE_LIMIT) {
      return res.status(429).json({
        ...usageStats(user, used),
        error: `You've used all ${FREE_LIMIT} free AI analyses this month. Upgrade to Pro for unlimited.`,
      });
    }

    const accounts = await query(`
      SELECT a.*, cd.apr, cd.minimum_payment
      FROM accounts a
      LEFT JOIN credit_details cd ON cd.account_id = a.id
      LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
      WHERE a.type = 'credit' AND pi.user_id = $1
    `, [user.id]);

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const txRows = await query(`
      SELECT category, SUM(amount) as total
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      JOIN plaid_items pi ON pi.id = a.plaid_item_id
      WHERE t.date >= $1 AND t.amount > 0 AND pi.user_id = $2
      GROUP BY category
      ORDER BY total DESC
    `, [since.toISOString().split('T')[0], user.id]);

    const spendingByCategory = Object.fromEntries(
      txRows.filter(r => r.category).map(r => [r.category, parseFloat(r.total)])
    );

    const totalDebt       = accounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const monthlyInterest = accounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
    const totalMin        = accounts.reduce((s, a) => s + (a.minimum_payment || 0), 0);
    const sinkingTotal    = (await getExpenses(user.id)).reduce((s, e) => s + e.amount, 0);
    const surplus         = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin - sinkingTotal;

    const insightText = await getSpendingInsight(
      user, accounts, spendingByCategory, totalDebt, monthlyInterest, surplus
    );

    await incrementUsage(user.id, ym);
    const saved   = await saveInsight(user.id, insightText);
    const newUsed = used + 1;

    res.json({ insight: saved, ...usageStats(user, newUsed) });
  } catch (err) {
    console.error('[insights/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
