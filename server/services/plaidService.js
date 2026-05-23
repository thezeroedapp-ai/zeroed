require('dotenv').config();
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');
const db = require('../db/database');

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET':    process.env.PLAID_SECRET,
    },
  },
}));

async function createLinkToken(uid) {
  const response = await client.linkTokenCreate({
    user: { client_user_id: uid },
    client_name:   'Zeroed',
    products:      [Products.Transactions, Products.Liabilities],
    country_codes: [CountryCode.Us],
    language:      'en',
  });
  return response.data.link_token;
}

async function exchangePublicToken(publicToken) {
  const response = await client.itemPublicTokenExchange({ public_token: publicToken });
  return { accessToken: response.data.access_token, itemId: response.data.item_id };
}

async function getAccounts(accessToken) {
  const [accountsResp, liabilitiesResp] = await Promise.allSettled([
    client.accountsGet({ access_token: accessToken }),
    client.liabilitiesGet({ access_token: accessToken }),
  ]);

  const accounts    = accountsResp.value?.data?.accounts || [];
  const creditCards = liabilitiesResp.value?.data?.liabilities?.credit || [];

  const creditDetailMap = {};
  for (const card of creditCards) {
    const purchaseApr = (card.aprs || []).find(a => a.apr_type === 'purchase_apr') || card.aprs?.[0];
    creditDetailMap[card.account_id] = {
      apr:                   purchaseApr?.apr_percentage ?? null,
      is_promotional_apr:    purchaseApr?.apr_type?.includes('promotional') ?? false,
      promo_apr_expiry_date: null,
      minimum_payment:       card.minimum_payment_amount ?? null,
      payment_due_date:      card.next_payment_due_date || null,
    };
  }

  return accounts.map(a => ({
    plaid_account_id:  a.account_id,
    name:              a.name,
    type:              a.type,     // 'depository', 'credit', 'investment', 'loan', 'mortgage', 'brokerage'
    subtype:           a.subtype,  // 'checking', 'savings', 'credit card', '401k', 'ira', etc.
    balance_current:   a.balances.current,
    balance_available: a.balances.available,
    credit_limit:      a.balances.limit,
    credit_details:    creditDetailMap[a.account_id] || null,
  }));
}

async function createUpdateLinkToken(uid, accessToken) {
  const response = await client.linkTokenCreate({
    user:         { client_user_id: uid },
    client_name:  'Zeroed',
    country_codes: [CountryCode.Us],
    language:     'en',
    access_token: accessToken,
  });
  return response.data.link_token;
}

async function removeItem(accessToken) {
  await client.itemRemove({ access_token: accessToken });
}

// Cursor-based incremental sync — replaces old transactionsGet
async function syncTransactions(accessToken, cursor = null) {
  const added = [], modified = [], removed = [];
  let nextCursor = cursor;
  let hasMore = true;

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor:       nextCursor || undefined,
    });
    added.push(...response.data.added);
    modified.push(...response.data.modified);
    removed.push(...response.data.removed);
    nextCursor = response.data.next_cursor;
    hasMore    = response.data.has_more;
  }

  return { added, modified, removed, nextCursor };
}

function mapTransaction(t) {
  return {
    plaid_transaction_id: t.transaction_id,
    account_id:           t.account_id,
    date:                 t.date,
    description:          t.name,
    amount:               t.amount,
    category:             t.personal_finance_category?.primary || t.category?.[0] || null,
  };
}

async function syncAllAccounts(uid) {
  const items   = await db.getPlaidItems(uid);
  const results = { accounts: 0, transactions: 0, removed: 0, errors: [] };

  for (const item of items) {
    try {
      const accounts = await getAccounts(item.access_token);
      for (const acct of accounts) {
        const { credit_details, ...rest } = acct;
        await db.upsertAccount(uid, {
          ...rest,
          ...(credit_details || {}),
          plaid_item_id:    item.id,
          institution_name: item.institution_name || null,
        });
      }
      results.accounts += accounts.length;

      const { added, modified, removed, nextCursor } = await syncTransactions(
        item.access_token,
        item.transactions_cursor || null,
      );

      const toSave = [...added, ...modified].filter(t => t.account_id).map(mapTransaction);
      if (toSave.length) await db.saveTransactions(uid, toSave);
      results.transactions += toSave.length;

      const removedIds = removed.map(r => r.transaction_id);
      if (removedIds.length) await db.deleteTransactions(uid, removedIds);
      results.removed += removedIds.length;

      await db.upsertPlaidItem(uid, item.id, {
        transactions_cursor: nextCursor,
        error_status:        null,
        updated_at:          db.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      const code = err.response?.data?.error_code;
      if (code === 'ITEM_LOGIN_REQUIRED' || code === 'ITEM_NOT_FOUND') {
        await db.upsertPlaidItem(uid, item.id, { error_status: code });
        results.errors.push({ item_id: item.id, institution_name: item.institution_name, error_code: code });
      } else {
        throw err;
      }
    }
  }

  try {
    const allAccounts = await db.getAccountsByUser(uid);
    await db.recordNetWorthSnapshot(uid, allAccounts);
  } catch (snapErr) {
    console.error('[syncAllAccounts] Net worth snapshot failed:', snapErr.message);
  }

  return results;
}

module.exports = { createLinkToken, createUpdateLinkToken, removeItem, exchangePublicToken, getAccounts, syncAllAccounts };
