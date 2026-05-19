require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');
const { init, getDb } = require('./db/database');
const payoffEngine   = require('./services/payoffEngine');
const { syncAllAccounts } = require('./services/plaidService');

const plaidRoutes       = require('./routes/plaid');
const planRoutes        = require('./routes/plan');
const transactionRoutes = require('./routes/transactions');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---
app.use('/api/plaid',        plaidRoutes);
app.use('/api/plan',         planRoutes);
app.use('/api/transactions', transactionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/user', (req, res) => {
  const user = getDb().prepare('SELECT * FROM users WHERE id = 1').get();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
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

app.get('/api/dashboard', (req, res) => {
  try {
    const db       = getDb();
    const user     = db.prepare('SELECT * FROM users WHERE id = 1').get();
    const accounts = db.prepare(CREDIT_ACCOUNTS_QUERY).all();

    const totalDebt      = accounts.reduce((s, a) => s + (a.balance_current || 0), 0);
    const monthlyInterest= accounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
    const totalMinimums  = accounts.reduce((s, a) => s + (a.minimum_payment || 0), 0);
    const surplus        = (user?.monthly_income || 0) - (user?.monthly_expenses || 0) - totalMinimums;
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

app.put('/api/user', (req, res) => {
  const { monthly_income, monthly_expenses, strategy } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare(`
    UPDATE users SET
      monthly_income   = COALESCE(?, monthly_income),
      monthly_expenses = COALESCE(?, monthly_expenses),
      strategy         = COALESCE(?, strategy)
    WHERE id = 1
  `).run(monthly_income ?? null, monthly_expenses ?? null, strategy ?? null);
  res.json(db.prepare('SELECT * FROM users WHERE id = 1').get());
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// --- Seed helpers ---

function seedUser(db) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('venkat@zeroed.app');
  if (existing) return existing.id;
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO users (name, email, monthly_income, monthly_expenses, strategy)
    VALUES (?, ?, ?, ?, ?)
  `).run('Venkat', 'venkat@zeroed.app', 7008, 3900, 'avalanche');
  console.log('  Seeded user: Venkat');
  return lastInsertRowid;
}

function seedDevAccounts(db, userId) {
  // Skip if dev accounts already exist
  const check = db.prepare("SELECT id FROM plaid_items WHERE item_id = 'dev_seed'").get();
  if (check) return;

  const { lastInsertRowid: plaidItemId } = db.prepare(`
    INSERT INTO plaid_items (user_id, access_token, item_id, institution_name, institution_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, 'access_token_dev', 'dev_seed', 'Development Seed', 'dev');

  const upsertAccount = db.prepare(`
    INSERT OR IGNORE INTO accounts
      (plaid_item_id, plaid_account_id, name, type, balance_current, credit_limit)
    VALUES
      (@plaid_item_id, @plaid_account_id, @name, @type, @balance_current, @credit_limit)
  `);

  const upsertCredit = db.prepare(`
    INSERT OR IGNORE INTO credit_details
      (account_id, apr, is_promotional_apr, promo_apr_expiry_date, minimum_payment, payment_due_date)
    VALUES
      (@account_id, @apr, @is_promotional_apr, @promo_apr_expiry_date, @minimum_payment, @payment_due_date)
  `);

  const getAccountId = db.prepare('SELECT id FROM accounts WHERE plaid_account_id = ?');

  const devAccounts = [
    {
      plaid_account_id: 'dev_chase_southwest',
      name: 'Chase Southwest Rapid Rewards',
      type: 'credit',
      balance_current: 779.92,
      credit_limit: 5000,
      credit: {
        apr: 23.49,
        is_promotional_apr: 0,
        promo_apr_expiry_date: null,
        minimum_payment: 40,
        payment_due_date: '2026-05-10',
      },
    },
    {
      plaid_account_id: 'dev_bilt',
      name: 'Bilt Palladium',
      type: 'credit',
      balance_current: 3041.81,
      credit_limit: 10000,
      credit: {
        apr: 10,
        is_promotional_apr: 1,
        promo_apr_expiry_date: '2026-09-17',  // ~4 months from May 2026
        minimum_payment: 31,
        payment_due_date: '2026-05-19',
      },
    },
    {
      plaid_account_id: 'dev_citi',
      name: 'Citi Double Cash',
      type: 'credit',
      balance_current: 8382.27,
      credit_limit: 12000,
      credit: {
        apr: 21.49,
        is_promotional_apr: 0,
        promo_apr_expiry_date: null,
        minimum_payment: 237.47,
        payment_due_date: '2026-05-20',
      },
    },
    {
      plaid_account_id: 'dev_bofa',
      name: 'BofA Visa Signature',
      type: 'credit',
      balance_current: 15455.76,
      credit_limit: 20000,
      // Regular APR is 23.49%; $8,699 of the balance is at 0% promo until Aug 17 2026
      credit: {
        apr: 23.49,
        is_promotional_apr: 1,
        promo_apr_expiry_date: '2026-08-17',
        minimum_payment: 277,
        payment_due_date: '2026-05-14',
      },
    },
    {
      plaid_account_id: 'dev_chase_sapphire',
      name: 'Chase Sapphire Preferred',
      type: 'credit',
      balance_current: 27336.01,
      credit_limit: 35000,
      credit: {
        apr: 19.49,
        is_promotional_apr: 0,
        promo_apr_expiry_date: null,
        minimum_payment: 719,
        payment_due_date: '2026-05-27',
      },
    },
  ];

  db.transaction(() => {
    for (const acct of devAccounts) {
      upsertAccount.run({ plaid_item_id: plaidItemId, ...acct });
      const { id } = getAccountId.get(acct.plaid_account_id);
      upsertCredit.run({ account_id: id, ...acct.credit });
    }
  })();

  console.log('  Seeded 5 dev accounts');
}

// --- Startup ---

function start() {
  init();
  const db = getDb();
  console.log('Seeding...');
  const userId = seedUser(db);
  seedDevAccounts(db, userId);

  // Daily sync at 8am
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Starting daily sync…');
    try {
      const result   = await syncAllAccounts(1);
      const accounts = getDb().prepare(CREDIT_ACCOUNTS_QUERY).all();
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

start();
