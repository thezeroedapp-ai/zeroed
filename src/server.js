require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const { init, query, queryOne, withTransaction, getExpenses } = require('./db/database');
const payoffEngine   = require('./services/payoffEngine');
const { syncAllAccounts } = require('./services/plaidService');
const { authenticate } = require('./middleware/auth');

const plaidRoutes           = require('./routes/plaid');
const planRoutes            = require('./routes/plan');
const transactionRoutes     = require('./routes/transactions');
const goalsRoutes           = require('./routes/goals');
const expensesRoutes        = require('./routes/expenses');
const insightsRoutes        = require('./routes/insights');
const recommendationsRoutes = require('./routes/recommendations');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public config endpoint — exposes Supabase URL + anon key to the frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All API routes below require a valid Supabase JWT
app.use('/api', authenticate);

// --- Routes ---
app.use('/api/plaid',           plaidRoutes);
app.use('/api/plan',            planRoutes);
app.use('/api/transactions',    transactionRoutes);
app.use('/api/expenses',        expensesRoutes);
app.use('/api/goals',           goalsRoutes);
app.use('/api/insights',        insightsRoutes);
app.use('/api/recommendations', recommendationsRoutes);

const CREDIT_ACCOUNTS_QUERY = `
  SELECT a.*, cd.apr, cd.is_promotional_apr, cd.promo_apr_expiry_date,
         cd.minimum_payment, cd.payment_due_date, pi.institution_name
  FROM accounts a
  LEFT JOIN credit_details cd ON cd.account_id = a.id
  LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
  WHERE a.type = 'credit' AND pi.user_id = $1
  ORDER BY a.balance_current DESC
`;

app.get('/api/user', async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const userId  = req.user.id;
    const user    = req.user;
    const accounts = await query(CREDIT_ACCOUNTS_QUERY, [userId]);

    const expenses       = await getExpenses(userId);
    const sinkingTotal   = expenses.reduce((s, e) => s + e.amount, 0);
    const totalDebt      = accounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const monthlyInterest= accounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
    const totalMinimums  = accounts.reduce((s, a) => s + (a.minimum_payment || 0), 0);
    const surplus        = (user?.monthly_income || 0) - (user?.monthly_expenses || 0) - totalMinimums - sinkingTotal;
    const strategy       = user?.strategy || 'avalanche';

    const debts = accounts.filter(a => a.balance_current > 0).map(a => ({
      name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0,
    }));

    const { months } = payoffEngine.simulatePayoff(debts, surplus, strategy);
    const debtFreeDate = months > 0 ? (() => {
      const d = new Date(); d.setMonth(d.getMonth() + months);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })() : null;

    const priorityCard = [...accounts]
      .filter(a => a.balance_current > 0)
      .sort((a, b) => strategy === 'avalanche'
        ? (b.apr || 0) - (a.apr || 0) || a.balance_current - b.balance_current
        : a.balance_current - b.balance_current
      )[0] || null;

    res.json({
      user,
      totalDebt:       Math.round(totalDebt * 100) / 100,
      monthlyInterest: Math.round(monthlyInterest * 100) / 100,
      totalMinimums:   Math.round(totalMinimums * 100) / 100,
      surplus:         Math.round(surplus * 100) / 100,
      debtFreeMonths:  months,
      debtFreeDate,
      priorityCard,
      alerts:          payoffEngine.checkAlerts(accounts),
      accountCount:    accounts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user', async (req, res) => {
  try {
    const { monthly_income, monthly_expenses, strategy } = req.body;
    const updated = await queryOne(`
      UPDATE users SET
        monthly_income   = COALESCE($1, monthly_income),
        monthly_expenses = COALESCE($2, monthly_expenses),
        strategy         = COALESCE($3, strategy)
      WHERE id = $4
      RETURNING *
    `, [monthly_income ?? null, monthly_expenses ?? null, strategy ?? null, req.user.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// --- Startup ---

async function start() {
  await init();

  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Starting daily sync…');
    try {
      const users = await query('SELECT id FROM users');
      for (const u of users) {
        const result   = await syncAllAccounts(u.id);
        const accounts = await query(CREDIT_ACCOUNTS_QUERY, [u.id]);
        const alerts   = payoffEngine.checkAlerts(accounts);
        console.log(`[cron] User ${u.id}: synced ${result.accounts} accounts, ${result.transactions} transactions. ${alerts.length} alert(s)`);
      }
    } catch (err) {
      console.error('[cron] Daily sync failed:', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`Zeroed running → http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
