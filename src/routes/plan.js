const express = require('express');
const router  = express.Router();
const payoffEngine  = require('../services/payoffEngine');
const claudeService = require('../services/claudeService');
const { getDb, savePlan, getPayoffPlan } = require('../db/database');

const ACCOUNTS_QUERY = `
  SELECT a.id, a.name, a.balance_current, a.credit_limit, a.type,
         cd.apr, cd.is_promotional_apr, cd.promo_apr_expiry_date,
         cd.minimum_payment, cd.payment_due_date
  FROM accounts a
  LEFT JOIN credit_details cd ON cd.account_id = a.id
  WHERE a.type = 'credit'
`;

// POST /api/plan/generate
router.post('/generate', async (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    if (!user) return res.status(400).json({ error: 'User not found' });

    const accounts = db.prepare(ACCOUNTS_QUERY + ' AND a.balance_current > 0').all();
    if (!accounts.length) return res.status(400).json({ error: 'No debt accounts found.' });

    const strategy = req.body.strategy || user.strategy || 'avalanche';
    const debts = accounts.map(a => ({
      name:          a.name,
      balance:       a.balance_current,
      apr:           a.apr || 0,
      minimumPayment:a.minimum_payment || 0,
    }));

    const plan = payoffEngine.calculatePayoffPlan(
      debts, user.monthly_income, user.monthly_expenses, 0, strategy
    );

    // Claude insight — non-fatal if API key missing
    let insight = null;
    try {
      insight = await claudeService.getPayoffInsight(plan, accounts, plan.extraBudget, strategy);
    } catch (e) {
      console.warn('[plan/generate] Claude insight skipped:', e.message);
    }

    // Persist plan to DB
    const nameToId = Object.fromEntries(accounts.map(a => [a.name, a.id]));
    savePlan({
      user_id:          1,
      strategy,
      total_debt:       Math.round(accounts.reduce((s, a) => s + a.balance_current, 0) * 100) / 100,
      monthly_interest: Math.round(payoffEngine.calculateMonthlyInterest(debts) * 100) / 100,
      surplus:          plan.surplus,
      debt_free_estimate: plan.debtFreeDate,
      insight:          insight || null,
      items: plan.order.map(d => ({
        account_id:             nameToId[d.name],
        priority_order:         d.priority,
        estimated_payoff_month: plan.perCardTimeline[d.name]
          ? (() => { const dt = new Date(); dt.setMonth(dt.getMonth() + plan.perCardTimeline[d.name]); return dt.toISOString().slice(0, 7); })()
          : null,
        monthly_interest: Math.round(d.balance * (d.apr / 100 / 12) * 100) / 100,
        notes: null,
      })),
    });

    res.json({ plan, insight });
  } catch (err) {
    console.error('[plan/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plan/latest
router.get('/latest', (req, res) => {
  try {
    const plan = getPayoffPlan(1);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/lump-sum — simulate applying a one-time extra payment
router.post('/lump-sum', (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    if (!user) return res.status(400).json({ error: 'User not found' });

    const accounts = db.prepare(ACCOUNTS_QUERY + ' AND a.balance_current > 0').all();
    const { amount, accountId, strategy: reqStrategy } = req.body;
    const strategy = reqStrategy || user.strategy || 'avalanche';
    const lump = parseFloat(amount) || 0;

    const debts = accounts.map(a => ({
      id: a.id, name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0,
    }));
    const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const surplus  = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin;

    res.json(payoffEngine.simulateLumpSum(debts, lump, accountId || null, Math.max(0, surplus), strategy));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/required-payment — how much extra per month to hit a target date
router.post('/required-payment', (req, res) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    if (!user) return res.status(400).json({ error: 'User not found' });

    const accounts = db.prepare(ACCOUNTS_QUERY + ' AND a.balance_current > 0').all();
    const { targetDate, strategy: reqStrategy } = req.body;
    if (!targetDate) return res.status(400).json({ error: 'targetDate required' });

    const strategy = reqStrategy || user.strategy || 'avalanche';
    const debts = accounts.map(a => ({
      name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0,
    }));
    const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const surplus  = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin;

    const target = new Date(targetDate);
    const now    = new Date();
    const targetMonths = Math.round((target - now) / (1000 * 60 * 60 * 24 * 30.44));
    if (targetMonths <= 0) return res.status(400).json({ error: 'Target date must be in the future' });

    const result = payoffEngine.calculateRequiredPayment(debts, targetMonths, Math.max(0, surplus), strategy);
    res.json({ ...result, targetMonths, currentSurplus: Math.round(surplus * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plan/alerts
router.get('/alerts', (req, res) => {
  try {
    const accounts = getDb().prepare(ACCOUNTS_QUERY).all();
    res.json(payoffEngine.checkAlerts(accounts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
