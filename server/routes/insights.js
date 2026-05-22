const express  = require('express');
const router   = express.Router();
const db       = require('../db/database');
const { getSpendingInsight } = require('../services/claudeService');

const FREE_LIMIT = 10;

function yearMonth() { return new Date().toISOString().slice(0, 7); }

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
    const insight = await db.getLatestInsight(user.uid);
    const used    = (await db.getUsage(user.uid, yearMonth()))?.count || 0;
    res.json({ insight: insight || null, ...usageStats(user, used) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/insights/generate
router.post('/generate', async (req, res) => {
  try {
    const user = req.user;
    const uid  = user.uid;
    const ym   = yearMonth();
    const used = (await db.getUsage(uid, ym))?.count || 0;

    if (!user.is_pro && used >= FREE_LIMIT) {
      return res.status(429).json({
        ...usageStats(user, used),
        error: `You've used all ${FREE_LIMIT} free AI analyses this month. Upgrade to Pro for unlimited.`,
      });
    }

    const allAccounts = await db.getAccountsByUser(uid);
    const accounts    = allAccounts.filter(a => a.type === 'credit');

    // Spending by category for last 90 days
    const since    = new Date();
    since.setDate(since.getDate() - 90);
    const sinceStr = since.toISOString().split('T')[0];
    const txSnap   = await db.userRef(uid).collection('transactions').where('date', '>=', sinceStr).get();

    const byCategory = {};
    txSnap.docs.forEach(d => {
      const { category, amount } = d.data();
      if (!category || amount <= 0) return;
      byCategory[category] = (byCategory[category] || 0) + amount;
    });

    const totalDebt       = accounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const monthlyInterest = accounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
    const totalMin        = accounts.reduce((s, a) => s + (a.minimum_payment || 0), 0);
    const expenses        = await db.getExpenses(uid);
    const sinkingTotal    = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const surplus         = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin - sinkingTotal;

    const insightText = await getSpendingInsight(user, accounts, byCategory, totalDebt, monthlyInterest, surplus);

    await db.incrementUsage(uid, ym);
    const saved   = await db.saveInsight(uid, insightText);
    const newUsed = used + 1;

    res.json({ insight: saved, ...usageStats(user, newUsed) });
  } catch (err) {
    console.error('[insights/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
