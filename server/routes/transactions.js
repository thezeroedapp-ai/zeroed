const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { account_id, limit = 50, offset = 0 } = req.query;
    const transactions = await db.getTransactionsByUser(req.user.uid, { accountId: account_id, limit, offset });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await db.getTransactionSummary(req.user.uid);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/trends — 6-month spending by category
router.get('/trends', async (req, res) => {
  try {
    const transactions = await db.getTransactionsByUser(req.user.uid, { limit: 1000 });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().split('T')[0];

    const purchases = transactions.filter(t => t.amount > 0 && t.date >= cutoff);

    const byYearMonth = {};
    purchases.forEach(t => {
      const ym  = t.date.substring(0, 7); // 'YYYY-MM'
      const cat = t.category || 'Other';
      if (!byYearMonth[ym]) byYearMonth[ym] = {};
      byYearMonth[ym][cat] = (byYearMonth[ym][cat] || 0) + t.amount;
    });

    const sortedYMs = Object.keys(byYearMonth).sort(); // lexicographic = chronological for YYYY-MM

    const catTotals = {};
    purchases.forEach(t => {
      const cat = t.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + t.amount;
    });
    const topCategories = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([cat]) => cat);

    const data = sortedYMs.map(ym => {
      const [year, month] = ym.split('-');
      const label = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const entry = { month: label };
      topCategories.forEach(cat => {
        entry[cat] = Math.round((byYearMonth[ym][cat] || 0) * 100) / 100;
      });
      return entry;
    });

    res.json({ data, categories: topCategories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/recurring — detect subscriptions and recurring charges
router.get('/recurring', async (req, res) => {
  try {
    const transactions = await db.getTransactionsByUser(req.user.uid, { limit: 500 });

    const byDesc = {};
    transactions
      .filter(t => t.amount > 0)
      .forEach(t => {
        const key = (t.description || '').toLowerCase().trim();
        if (!key) return;
        if (!byDesc[key]) byDesc[key] = [];
        byDesc[key].push(t);
      });

    const recurring = [];
    for (const txs of Object.values(byDesc)) {
      const uniqueMonths = new Set(txs.map(t => t.date.substring(0, 7)));
      if (uniqueMonths.size < 2) continue;
      const amounts   = txs.map(t => t.amount);
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const sorted    = [...txs].sort((a, b) => b.date.localeCompare(a.date));
      recurring.push({
        description:      sorted[0].description,
        category:         sorted[0].category || 'Other',
        avgAmount:        Math.round(avgAmount * 100) / 100,
        annualEstimate:   Math.round(avgAmount * 12 * 100) / 100,
        occurrences:      txs.length,
        months:           uniqueMonths.size,
        lastDate:         sorted[0].date,
      });
    }

    recurring.sort((a, b) => b.avgAmount - a.avgAmount);
    res.json({ recurring: recurring.slice(0, 30) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
