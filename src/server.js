require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const { init, query, queryOne, withTransaction, getExpenses } = require('./db/database');
const payoffEngine   = require('./services/payoffEngine');
const { syncAllAccounts } = require('./services/plaidService');

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

// --- Routes ---
app.use('/api/plaid',           plaidRoutes);
app.use('/api/plan',            planRoutes);
app.use('/api/transactions',    transactionRoutes);
app.use('/api/expenses',        expensesRoutes);
app.use('/api/goals',           goalsRoutes);
app.use('/api/insights',        insightsRoutes);
app.use('/api/recommendations', recommendationsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/user', async (req, res) => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id = 1');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const CREDIT_ACCOUNTS_QUERY = `
  SELECT a.*, cd.apr, cd.is_promotional_apr, cd.promo_apr_expiry_date,
         cd.minimum_payment, cd.payment_due_date, pi.institution_name
  FROM accounts a
  LEFT JOIN credit_details cd ON cd.account_id = a.id
  LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
  WHERE a.type = 'credit'
  ORDER BY a.balance_current DESC
`;

app.get('/api/dashboard', async (req, res) => {
  try {
    const user     = await queryOne('SELECT * FROM users WHERE id = 1');
    const accounts = await query(CREDIT_ACCOUNTS_QUERY);

    const expenses       = await getExpenses(1);
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
    const user = await queryOne('SELECT id FROM users WHERE id = 1');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updated = await queryOne(`
      UPDATE users SET
        monthly_income   = COALESCE($1, monthly_income),
        monthly_expenses = COALESCE($2, monthly_expenses),
        strategy         = COALESCE($3, strategy)
      WHERE id = 1
      RETURNING *
    `, [monthly_income ?? null, monthly_expenses ?? null, strategy ?? null]);
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

// --- Seed helpers ---

async function seedUser() {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', ['venkat@zeroed.app']);
  if (existing) return existing.id;
  const user = await queryOne(`
    INSERT INTO users (name, email, monthly_income, monthly_expenses, strategy)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, ['Venkat', 'venkat@zeroed.app', 7008, 3900, 'avalanche']);
  console.log('  Seeded user: Venkat');
  return user.id;
}

async function seedDevAccounts(userId) {
  const check = await queryOne("SELECT id FROM plaid_items WHERE item_id = 'dev_seed'");
  if (check) return;

  const item = await queryOne(`
    INSERT INTO plaid_items (user_id, access_token, item_id, institution_name, institution_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [userId, 'access_token_dev', 'dev_seed', 'Development Seed', 'dev']);

  const devAccounts = [
    { plaid_account_id:'dev_chase_southwest', name:'Chase Southwest Rapid Rewards', type:'credit', balance_current:779.92,   credit_limit:5000,  credit:{ apr:23.49, is_promotional_apr:0, promo_apr_expiry_date:null,         minimum_payment:40,     payment_due_date:'2026-05-10' } },
    { plaid_account_id:'dev_bilt',            name:'Bilt Palladium',                type:'credit', balance_current:3041.81,  credit_limit:10000, credit:{ apr:10,    is_promotional_apr:1, promo_apr_expiry_date:'2026-09-17',  minimum_payment:31,     payment_due_date:'2026-05-19' } },
    { plaid_account_id:'dev_citi',            name:'Citi Double Cash',              type:'credit', balance_current:8382.27,  credit_limit:12000, credit:{ apr:21.49, is_promotional_apr:0, promo_apr_expiry_date:null,         minimum_payment:237.47, payment_due_date:'2026-05-20' } },
    { plaid_account_id:'dev_bofa',            name:'BofA Visa Signature',           type:'credit', balance_current:15455.76, credit_limit:20000, credit:{ apr:23.49, is_promotional_apr:1, promo_apr_expiry_date:'2026-08-17',  minimum_payment:277,    payment_due_date:'2026-05-14' } },
    { plaid_account_id:'dev_chase_sapphire',  name:'Chase Sapphire Preferred',      type:'credit', balance_current:27336.01, credit_limit:35000, credit:{ apr:19.49, is_promotional_apr:0, promo_apr_expiry_date:null,         minimum_payment:719,    payment_due_date:'2026-05-27' } },
  ];

  await withTransaction(async (client) => {
    for (const acct of devAccounts) {
      await client.query(`
        INSERT INTO accounts (plaid_item_id, plaid_account_id, name, type, balance_current, credit_limit)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(plaid_account_id) DO NOTHING
      `, [item.id, acct.plaid_account_id, acct.name, acct.type, acct.balance_current, acct.credit_limit]);

      const { rows: [{ id }] } = await client.query(
        'SELECT id FROM accounts WHERE plaid_account_id = $1', [acct.plaid_account_id]
      );

      await client.query(`
        INSERT INTO credit_details
          (account_id, apr, is_promotional_apr, promo_apr_expiry_date, minimum_payment, payment_due_date)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT(account_id) DO NOTHING
      `, [id, acct.credit.apr, acct.credit.is_promotional_apr, acct.credit.promo_apr_expiry_date,
          acct.credit.minimum_payment, acct.credit.payment_due_date]);
    }
  });

  console.log('  Seeded 5 dev accounts');
}

// --- Startup ---

async function start() {
  await init();
  console.log('Seeding...');
  const userId = await seedUser();
  await seedDevAccounts(userId);

  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Starting daily sync…');
    try {
      const result   = await syncAllAccounts(1);
      const accounts = await query(CREDIT_ACCOUNTS_QUERY);
      const alerts   = payoffEngine.checkAlerts(accounts);
      console.log(`[cron] Synced ${result.accounts} accounts, ${result.transactions} transactions. ${alerts.length} alert(s): ${alerts.map(a => a.title).join(' | ') || 'none'}`);
    } catch (err) {
      console.error('[cron] Daily sync failed:', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`Zeroed running → http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
