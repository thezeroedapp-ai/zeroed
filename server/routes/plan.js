const express      = require('express');
const router       = express.Router();
const payoffEngine = require('../services/payoffEngine');
const claudeService= require('../services/claudeService');
const db           = require('../db/database');

async function getCreditAccounts(uid) {
  const accounts = await db.getAccountsByUser(uid);
  return accounts.filter(a => a.type === 'credit');
}

// POST /api/plan/generate
router.post('/generate', async (req, res) => {
  try {
    const user        = req.user;
    const uid         = user.uid;
    const allAccounts = await getCreditAccounts(uid);
    const accounts    = allAccounts.filter(a => a.balance_current > 0);
    if (!accounts.length) return res.status(400).json({ error: 'No debt accounts found.' });

    const strategy     = req.body.strategy || user.strategy || 'avalanche';
    const sinkingFunds = await db.getSinkingFunds(uid);
    const sinkingTotal = sinkingFunds.reduce((s, f) => s + (f.monthly_amount || 0), 0);
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

    const nameToAccount = Object.fromEntries(accounts.map(a => [a.name, a]));
    await db.savePlan(uid, {
      strategy,
      total_debt:         Math.round(accounts.reduce((s, a) => s + a.balance_current, 0) * 100) / 100,
      monthly_interest:   Math.round(payoffEngine.calculateMonthlyInterest(debts) * 100) / 100,
      surplus:            plan.surplus,
      debt_free_estimate: plan.debtFreeDate,
      insight:            insight || null,
      items: plan.order.map(d => {
        const acct = nameToAccount[d.name];
        return {
          account_id:             acct?.id || null,
          account_name:           d.name,
          balance_current:        acct?.balance_current || 0,
          credit_limit:           acct?.credit_limit || null,
          priority_order:         d.priority,
          estimated_payoff_month: plan.perCardTimeline[d.name]
            ? (() => { const dt = new Date(); dt.setMonth(dt.getMonth() + plan.perCardTimeline[d.name]); return dt.toISOString().slice(0, 7); })()
            : null,
          monthly_interest: Math.round(d.balance * (d.apr / 100 / 12) * 100) / 100,
          notes: null,
        };
      }),
    });

    const scenarios = payoffEngine.compareScenarios(debts, Math.max(0, plan.surplus), strategy);
    const cards = plan.order.map(d => {
      const months = plan.perCardTimeline[d.name];
      const payoffDate = months
        ? (() => { const dt = new Date(); dt.setMonth(dt.getMonth() + months); return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); })()
        : null;
      return {
        name:            d.name,
        balance_current: d.balance,
        apr:             d.apr,
        minimum_payment: d.minimumPayment,
        payoffMonth:     months || null,
        payoffDate,
      };
    });

    res.json({
      plan: {
        strategy,
        months:           plan.totalMonths,
        totalInterest:    plan.totalInterest,
        debtFreeDate:     plan.debtFreeDate,
        surplus:          plan.surplus,
        sinkingFundTotal: sinkingTotal,
        monthlyIncome:    user.monthly_income || 0,
        cards,
        scenarios: scenarios.filter(s => s.extraMonthly > 0).map(s => ({
          extra:         s.extraMonthly,
          months:        s.months,
          interestSaved: Math.round((plan.totalInterest - s.totalInterest) * 100) / 100,
        })),
      },
      insight,
    });
  } catch (err) {
    console.error('[plan/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plan/latest
router.get('/latest', async (req, res) => {
  try {
    res.json(await db.getPayoffPlan(req.user.uid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/lump-sum
router.post('/lump-sum', async (req, res) => {
  try {
    const user     = req.user;
    const accounts = (await getCreditAccounts(user.uid)).filter(a => a.balance_current > 0);
    const { amount, accountId, strategy: reqStrategy } = req.body;
    const strategy     = reqStrategy || user.strategy || 'avalanche';
    const lump         = parseFloat(amount) || 0;
    const debts        = accounts.map(a => ({ id: a.id, name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0 }));
    const totalMin     = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const sinkingTotal = (await db.getSinkingFunds(user.uid)).reduce((s, f) => s + (f.monthly_amount || 0), 0);
    const surplus      = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMin - sinkingTotal;

    res.json(payoffEngine.simulateLumpSum(debts, lump, accountId || null, Math.max(0, surplus), strategy));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/required-payment
router.post('/required-payment', async (req, res) => {
  try {
    const user     = req.user;
    const accounts = (await getCreditAccounts(user.uid)).filter(a => a.balance_current > 0);
    const { targetDate, strategy: reqStrategy } = req.body;
    if (!targetDate) return res.status(400).json({ error: 'targetDate required' });

    const strategy     = reqStrategy || user.strategy || 'avalanche';
    const debts        = accounts.map(a => ({ name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0 }));
    const totalMin     = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const sinkingTotal = (await db.getSinkingFunds(user.uid)).reduce((s, f) => s + (f.monthly_amount || 0), 0);
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
    const accounts = await getCreditAccounts(req.user.uid);
    res.json(payoffEngine.checkAlerts(accounts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
