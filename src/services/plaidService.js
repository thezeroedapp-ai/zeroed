require('dotenv').config();
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');
const { getDb, upsertAccount, saveTransactions } = require('../db/database');

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

async function createLinkToken(userId) {
  const response = await client.linkTokenCreate({
    user: { client_user_id: String(userId) },
    client_name: 'Zeroed',
    products: [Products.Transactions, Products.Liabilities],
    country_codes: [CountryCode.Us],
    language: 'en',
  });
  return response.data.link_token;
}

async function exchangePublicToken(publicToken) {
  const response = await client.itemPublicTokenExchange({ public_token: publicToken });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

async function getAccounts(accessToken) {
  const [accountsResp, liabilitiesResp] = await Promise.allSettled([
    client.accountsGet({ access_token: accessToken }),
    client.liabilitiesGet({ access_token: accessToken }),
  ]);

  const accounts = accountsResp.value?.data?.accounts || [];
  const creditCards = liabilitiesResp.value?.data?.liabilities?.credit || [];

  // Build a map of credit details keyed by plaid account_id
  const creditDetailMap = {};
  for (const card of creditCards) {
    const purchaseApr = (card.aprs || []).find(a => a.apr_type === 'purchase_apr') || card.aprs?.[0];
    creditDetailMap[card.account_id] = {
      apr: purchaseApr?.apr_percentage ?? null,
      is_promotional_apr: purchaseApr?.apr_type?.includes('promotional') ? 1 : 0,
      promo_apr_expiry_date: card.last_payment_date || null,
      minimum_payment: card.minimum_payment_amount ?? null,
      payment_due_date: card.next_payment_due_date || null,
    };
  }

  return accounts.map(a => ({
    plaid_account_id: a.account_id,
    name: a.name,
    type: a.type === 'credit' ? 'credit' : 'depository',
    balance_current: a.balances.current,
    balance_available: a.balances.available,
    credit_limit: a.balances.limit,
    credit_details: creditDetailMap[a.account_id] || null,
  }));
}

async function getTransactions(accessToken, startDate, endDate) {
  const now = new Date();
  const end = endDate || now.toISOString().split('T')[0];
  const start = startDate || (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  })();

  const response = await client.transactionsGet({
    access_token: accessToken,
    start_date: start,
    end_date: end,
    options: { count: 500 },
  });

  return response.data.transactions.map(t => ({
    plaid_transaction_id: t.transaction_id,
    plaid_account_id: t.account_id,
    date: t.date,
    description: t.name,
    amount: t.amount,
    category: t.category?.[0] || null,
  }));
}

async function syncAllAccounts(userId) {
  const db = getDb();
  const items = db.prepare('SELECT * FROM plaid_items WHERE user_id = ?').all(userId);
  const results = { accounts: 0, transactions: 0 };

  const upsertCreditDetails = db.prepare(`
    INSERT INTO credit_details (account_id, apr, is_promotional_apr, promo_apr_expiry_date, minimum_payment, payment_due_date)
    VALUES (@account_id, @apr, @is_promotional_apr, @promo_apr_expiry_date, @minimum_payment, @payment_due_date)
    ON CONFLICT(account_id) DO UPDATE SET
      apr                  = excluded.apr,
      is_promotional_apr   = excluded.is_promotional_apr,
      promo_apr_expiry_date= excluded.promo_apr_expiry_date,
      minimum_payment      = excluded.minimum_payment,
      payment_due_date     = excluded.payment_due_date,
      updated_at           = CURRENT_TIMESTAMP
  `);

  const getAccountId = db.prepare('SELECT id FROM accounts WHERE plaid_account_id = ?');

  for (const item of items) {
    const [accounts, transactions] = await Promise.all([
      getAccounts(item.access_token),
      getTransactions(item.access_token),
    ]);

    for (const acct of accounts) {
      upsertAccount({ ...acct, plaid_item_id: item.id });
      if (acct.credit_details) {
        const row = getAccountId.get(acct.plaid_account_id);
        if (row) upsertCreditDetails.run({ account_id: row.id, ...acct.credit_details });
      }
    }
    results.accounts += accounts.length;

    // Resolve plaid_account_id → db account id
    const dbAccounts = db.prepare('SELECT id, plaid_account_id FROM accounts').all();
    const acctIdMap = Object.fromEntries(dbAccounts.map(a => [a.plaid_account_id, a.id]));
    const mapped = transactions
      .filter(t => acctIdMap[t.plaid_account_id])
      .map(({ plaid_account_id, ...t }) => ({ ...t, account_id: acctIdMap[plaid_account_id] }));

    saveTransactions(mapped);
    results.transactions += mapped.length;
  }

  return results;
}

module.exports = { createLinkToken, exchangePublicToken, getAccounts, getTransactions, syncAllAccounts };
