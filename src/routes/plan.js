const express = require('express');
const router  = express.Router();
const payoffEngine  = require('../services/payoffEngine');
const claudeService = require('../services/claudeService');
const { query, queryOne, savePlan, getPayoffPlan, getExpenses } = require('../db/database');

function accountsQuery(userId) {
  return {
    text: `
      SELECT a.id, a.name, a.balance_current, a.credit_limit, a.type,
             cd.apr, cd.is_promotional_apr, cd.promo_apr_expiry_date,
             cd.minimum_payment, cd.payment_due_date
      FROM accounts a
      LEFT JOIN credit_details cd ON cd.account_id = a.id
      LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
      WHERE a.type = 'credit' AND pi.user_id = $1
    `,
    values: [userId],
  };
}

// POST /api/plan/generate
router.post('/generate', async (req, res) => {
  try {
    const user = req.user;
    const { text, values } = accountsQuery(user.id);
    const accounts = await query(text + ' AND a.balance_current > 0', values);
    if (!accounts.length) return res.status(400).json({ error: 'No debt accounts found.' });

    const strategy     = req.body.strategy || user.strategy || 'avalanche';
    const expenses     = await getExpenses(user.id);
    const sinkingTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const debts = accounts.map(a => ({
      name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0,
    }));

    const plan = payoffEngine.calculatePayoffPlan(
      debts, user.monthly_income, (user.monthly_expenses || 0) + sinkingTotal, 0, strategy
    );

    let insight = null;
    try {
      insight = await claudeService.getPayoffInsight(plan, accounts, plan.extraBudget, strategy);
    } catch (e) {
      console.warn('[plan/generate] Claude insight skipped:', e.message);
    }

    const nameToId = Object.fromEntries(accounts.map(a => [a.name, a.id]));
    await savePlan({
      user_id:           user.id,
      strategy,
      total_debt:        Math.round(accounts.reduce((s, a) => s + a.balance_current, 0) * 100) / 100,
      monthly_interest:  Math.round(payoffEngine.calculateMonthlyInterest(debts) * 100) / 100,
      surplus:           plan.surplus,
      debt_free_estimate: plan.debtFreeDate,
      insight:           insight || null,
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
router.get('/latest', async (req, res) => {
  try {
    res.json(await getPayoffPlan(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/lump-sum
router.post('/lump-sum', async (req, res) => {
  try {
    const user = req.user;
    const { text, values } = accountsQuery(user.id);
    const accounts = await query(text + ' AND a.balance_current > 0', values);

    const { amount, accountId, strategy: reqStrategy } = req.body;
    const strategy = reqStrategy || user.strategy || 'avalanche';
    const lump     = parseFloat(amount) || 0;

    const debts        = accounts.map(a => ({ id: a.id, name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0 }));
    const totalMin     = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const sinkingTotal = (await getExpenses(user.id)).reduce((s, e) => s + e.amount, 0);
    const surplus      = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin - sinkingTotal;

    res.json(payoffEngine.simulateLumpSum(debts, lump, accountId || null, Math.max(0, surplus), strategy));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/required-payment
router.post('/required-payment', async (req, res) => {
  try {
    const user = req.user;
    const { text, values } = accountsQuery(user.id);
    const accounts = await query(text + ' AND a.balance_current > 0', values);
    const { targetDate, strategy: reqStrategy } = req.body;
    if (!targetDate) return res.status(400).json({ error: 'targetDate required' });

    const strategy     = reqStrategy || user.strategy || 'avalanche';
    const debts        = accounts.map(a => ({ name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0 }));
    const totalMin     = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const sinkingTotal = (await getExpenses(user.id)).reduce((s, e) => s + e.amount, 0);
    const surplus      = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin - sinkingTotal;

    const target       = new Date(targetDate);
    const targetMonths = Math.round((target - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
    if (targetMonths <= 0) return res.status(400).json({ error: 'Target date must be in the future' });

    const result = payoffEngine.calculateRequiredPayment(debts, targetMonths, Math.max(0, surplus), strategy);
    res.json({ ...result, targetMonths, currentSurplus: Math.round(surplus * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plan/alerts
router.get('/alerts', async (req, res) => {
  try {
    const { text, values } = accountsQuery(req.user.id);
    const accounts = await query(text, values);
    res.json(payoffEngine.checkAlerts(accounts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
