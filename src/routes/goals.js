const express = require('express');
const router  = express.Router();
const { query, queryOne, getGoals, createGoal, deleteGoal } = require('../db/database');
const payoffEngine = require('../services/payoffEngine');

const ACCOUNTS_QUERY = `
  SELECT a.id, a.name, a.balance_current, a.credit_limit, a.type,
         cd.apr, cd.minimum_payment
  FROM accounts a
  LEFT JOIN credit_details cd ON cd.account_id = a.id
  WHERE a.type = 'credit' AND a.balance_current > 0
`;

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const goals    = await getGoals(1);
    const user     = await queryOne('SELECT * FROM users WHERE id = 1');
    const accounts = await query(ACCOUNTS_QUERY);

    const totalDebt = accounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const debts     = accounts.map(a => ({
      id: a.id, name: a.name, balance: a.balance_current,
      apr: a.apr || 0, minimumPayment: a.minimum_payment || 0,
    }));
    const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const surplus  = Math.max(0, (user?.monthly_income || 0) - (user?.monthly_expenses || 0) - totalMin);
    const strategy = user?.strategy || 'avalanche';

    const enriched = goals.map(g => {
      let progress = null, requiredExtra = null, onTrack = null, currentMonths = null;

      if (g.goal_type === 'debt_free_date' && g.target_date) {
        const targetMonths = Math.round((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
        const calc = payoffEngine.calculateRequiredPayment(debts, targetMonths, surplus, strategy);
        requiredExtra = calc.requiredExtra;
        currentMonths = calc.currentMonths;
        onTrack       = calc.requiredExtra === 0;
      } else if (g.goal_type === 'card_payoff' && g.account_id && g.target_date) {
        const card = accounts.find(a => a.id === g.account_id);
        if (card) {
          const targetMonths = Math.round((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
          const cardDebts = [{ id: card.id, name: card.name, balance: card.balance_current, apr: card.apr || 0, minimumPayment: card.minimum_payment || 0 }];
          const calc = payoffEngine.calculateRequiredPayment(cardDebts, targetMonths, surplus, 'avalanche');
          requiredExtra = calc.requiredExtra;
          currentMonths = calc.currentMonths;
          onTrack       = calc.requiredExtra === 0;
        }
      } else if (g.goal_type === 'balance_target' && g.target_balance != null) {
        progress = totalDebt > 0
          ? Math.min(100, Math.round(Math.max(0, (totalDebt - g.target_balance) / totalDebt * 100)))
          : 100;
        onTrack = totalDebt <= g.target_balance;
      }

      return { ...g, progress, requiredExtra, onTrack, currentMonths, totalDebt };
    });

    res.json({ goals: enriched, totalDebt, surplus, currentMonths: payoffEngine.simulatePayoff(debts, surplus, strategy).months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const { goal_type, target_date, target_balance, account_id, label } = req.body;
    if (!goal_type) return res.status(400).json({ error: 'goal_type required' });
    const goal = await createGoal({
      user_id:        1,
      goal_type,
      target_date:    target_date    || null,
      target_balance: target_balance != null ? parseFloat(target_balance) : null,
      account_id:     account_id     || null,
      label:          label          || null,
    });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteGoal(parseInt(req.params.id), 1);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
