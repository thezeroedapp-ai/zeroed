require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const db           = require('./db/database');
const payoffEngine = require('./services/payoffEngine');
const { authenticate } = require('./middleware/auth');

const plaidRoutes        = require('./routes/plaid');
const planRoutes         = require('./routes/plan');
const transactionRoutes  = require('./routes/transactions');
const goalsRoutes        = require('./routes/goals');
const sinkingFundsRoutes = require('./routes/sinking-funds');
const insightsRoutes     = require('./routes/insights');
const rewardsRoutes      = require('./routes/rewards');
const budgetsRoutes      = require('./routes/budgets');
const adminRoutes        = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

// Production: serve React build from apps/web/dist
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../apps/web/dist')));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All /api/* routes below require a valid Firebase ID token
app.use('/api', authenticate);

app.use('/api/plaid',         plaidRoutes);
app.use('/api/plan',          planRoutes);
app.use('/api/transactions',  transactionRoutes);
app.use('/api/sinking-funds', sinkingFundsRoutes);
app.use('/api/goals',         goalsRoutes);
app.use('/api/insights',      insightsRoutes);
app.use('/api/rewards',       rewardsRoutes);
app.use('/api/budgets',       budgetsRoutes);
app.use('/api/admin',         adminRoutes);

app.get('/api/user', async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const uid  = req.user.uid;
    const user = req.user;

    const allAccounts    = await db.getAccountsByUser(uid);
    const creditAccounts = allAccounts.filter(a => a.type === 'credit');
    const assetAccounts  = allAccounts.filter(a => ['depository', 'investment', 'brokerage'].includes(a.type));
    const loanAccounts   = allAccounts.filter(a => ['loan', 'mortgage'].includes(a.type));

    const sinkingFunds = await db.getSinkingFunds(uid);
    const sinkingTotal = sinkingFunds.reduce((s, f) => s + (f.monthly_amount || 0), 0);

    const totalDebt        = creditAccounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const totalLoanDebt    = loanAccounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const totalLiabilities = totalDebt + totalLoanDebt;
    const totalAssets      = assetAccounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const cashAssets       = allAccounts.filter(a => a.type === 'depository').reduce((s, a) => s + (a.balance_current || 0), 0);
    const investAssets     = allAccounts.filter(a => ['investment', 'brokerage'].includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
    const netWorth         = totalAssets - totalLiabilities;

    const monthlyInterest = creditAccounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
    const totalMinimums   = creditAccounts.reduce((s, a) => s + (a.minimum_payment || 0), 0);
    const surplus         = (user.monthly_income || 0) - (user.monthly_expenses || 0) - totalMinimums - sinkingTotal;
    const strategy        = user.strategy || 'avalanche';

    const debts = creditAccounts.filter(a => a.balance_current > 0).map(a => ({
      name: a.name, balance: a.balance_current, apr: a.apr || 0, minimumPayment: a.minimum_payment || 0,
    }));

    const { months } = payoffEngine.simulatePayoff(debts, surplus, strategy);
    const debtFreeDate = months > 0 ? (() => {
      const d = new Date(); d.setMonth(d.getMonth() + months);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })() : null;

    const priorityCard = [...creditAccounts]
      .filter(a => a.balance_current > 0)
      .sort((a, b) => strategy === 'avalanche'
        ? (b.apr || 0) - (a.apr || 0) || a.balance_current - b.balance_current
        : a.balance_current - b.balance_current
      )[0] || null;

    res.json({
      user,
      totalDebt:        Math.round(totalDebt * 100) / 100,
      totalAssets:      Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      netWorth:         Math.round(netWorth * 100) / 100,
      monthlyInterest:  Math.round(monthlyInterest * 100) / 100,
      totalMinimums:    Math.round(totalMinimums * 100) / 100,
      surplus:          Math.round(surplus * 100) / 100,
      debtFreeMonths:   months,
      debtFreeDate,
      priorityCard,
      alerts:           payoffEngine.checkAlerts(creditAccounts),
      accountCount:     creditAccounts.length,
      assetsByCategory: {
        cash:        Math.round(cashAssets    * 100) / 100,
        investments: Math.round(investAssets  * 100) / 100,
      },
      liabilitiesByCategory: {
        creditCards: Math.round(totalDebt     * 100) / 100,
        loans:       Math.round(totalLoanDebt * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard-config', async (req, res) => {
  try {
    const config = await db.getDashboardConfig(req.user.uid);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dashboard-config', async (req, res) => {
  try {
    const { widgets } = req.body;
    if (!Array.isArray(widgets)) return res.status(400).json({ error: 'widgets must be an array' });
    await db.saveDashboardConfig(req.user.uid, widgets);
    res.json({ widgets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/net-worth-history', async (req, res) => {
  try {
    const history = await db.getNetWorthHistory(req.user.uid);
    res.json({ history });
  } catch (err) {
    console.error('[net-worth-history]', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user', async (req, res) => {
  try {
    const { monthly_income, monthly_expenses, strategy } = req.body;
    const updates = {};
    if (monthly_income   != null) updates.monthly_income   = monthly_income;
    if (monthly_expenses != null) updates.monthly_expenses = monthly_expenses;
    if (strategy         != null) updates.strategy         = strategy;
    const updated = await db.upsertUser(req.user.uid, updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback — only in production, after all API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../apps/web/dist', 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Local development: start the server directly
if (require.main === module) {
  const cron             = require('node-cron');
  const { syncAllAccounts } = require('./services/plaidService');
  const PORT = process.env.PORT || 3000;

  async function start() {
    await db.init();

    cron.schedule('0 8 * * *', async () => {
      console.log('[cron] Starting daily sync…');
      try {
        const users = await db.getAllUsers();
        for (const u of users) {
          const result   = await syncAllAccounts(u.uid);
          const accounts = (await db.getAccountsByUser(u.uid)).filter(a => a.type === 'credit');
          const alerts   = payoffEngine.checkAlerts(accounts);
          console.log(`[cron] ${u.uid}: ${result.accounts} accounts, ${result.transactions} txs. ${alerts.length} alert(s)`);
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
}

module.exports = app;
