require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } else {
    // Cloud Functions runtime or GOOGLE_APPLICATION_CREDENTIALS env var
    admin.initializeApp();
  }
}

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Convert Firestore Timestamps to ISO strings so JSON.stringify works
function toObj(snap) {
  const data = snap.data() || {};
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v;
  }
  return out;
}

function userRef(uid) {
  return firestore.collection('users').doc(uid);
}

async function init() {
  await firestore.collection('users').limit(1).get();
  console.log('Firestore connected');
}

// --- Users ---

async function getUser(uid) {
  const snap = await userRef(uid).get();
  if (!snap.exists) return null;
  return { uid, ...toObj(snap) };
}

async function upsertUser(uid, data) {
  await userRef(uid).set(data, { merge: true });
  return getUser(uid);
}

// --- Accounts ---

async function getAccountsByUser(uid, { includeArchived = false } = {}) {
  const snap = await userRef(uid).collection('accounts').get();
  const all  = snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
  return includeArchived ? all : all.filter(a => !a.archived_at);
}

async function upsertAccount(uid, account) {
  const docId = account.plaid_account_id;
  if (!docId) throw new Error('plaid_account_id required');
  const { plaid_account_id, ...rest } = account;
  const ref = userRef(uid).collection('accounts').doc(docId);
  await ref.set({ ...rest, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  return docId;
}

// --- Plaid Items ---

async function getPlaidItems(uid) {
  const snap = await userRef(uid).collection('plaid_items').get();
  return snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
}

async function upsertPlaidItem(uid, itemId, data) {
  const ref = userRef(uid).collection('plaid_items').doc(itemId);
  await ref.set(data, { merge: true });
  return itemId;
}

// --- Transactions ---

async function saveTransactions(uid, transactions) {
  if (!transactions.length) return;
  for (let i = 0; i < transactions.length; i += 500) {
    const batch = firestore.batch();
    transactions.slice(i, i + 500).forEach(t => {
      const ref = userRef(uid).collection('transactions').doc(t.plaid_transaction_id);
      batch.set(ref, t, { merge: true });
    });
    await batch.commit();
  }
}

async function deleteTransactions(uid, transactionIds) {
  if (!transactionIds.length) return;
  for (let i = 0; i < transactionIds.length; i += 500) {
    const batch = firestore.batch();
    transactionIds.slice(i, i + 500).forEach(id => {
      batch.delete(userRef(uid).collection('transactions').doc(id));
    });
    await batch.commit();
  }
}

async function getTransactionsByUser(uid, { accountId, limit = 50, offset = 0 } = {}) {
  let q = userRef(uid).collection('transactions').orderBy('date', 'desc');
  if (accountId) q = q.where('account_id', '==', accountId);
  const snap = await q.limit(parseInt(limit) + parseInt(offset)).get();
  return snap.docs.slice(parseInt(offset)).map(d => ({ id: d.id, ...toObj(d) }));
}

async function getTransactionSummary(uid) {
  const snap = await userRef(uid).collection('transactions').where('amount', '>', 0).get();
  const byCategory = {};
  snap.docs.forEach(d => {
    const { category, amount } = d.data();
    if (!category) return;
    if (!byCategory[category]) byCategory[category] = { category, count: 0, total: 0 };
    byCategory[category].count++;
    byCategory[category].total += amount;
  });
  return Object.values(byCategory)
    .sort((a, b) => b.total - a.total)
    .map(r => ({ ...r, total: Math.round(r.total * 100) / 100 }));
}

// --- Payoff Plans ---

async function getPayoffPlan(uid) {
  const snap = await userRef(uid).collection('payoff_plans')
    .orderBy('generated_at', 'desc').limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...toObj(doc) };
}

async function savePlan(uid, plan) {
  const ref = userRef(uid).collection('payoff_plans').doc();
  await ref.set({ ...plan, generated_at: FieldValue.serverTimestamp() });
  return ref.id;
}

// --- Goals ---

async function getGoals(uid) {
  const snap = await userRef(uid).collection('goals').get();
  return snap.docs
    .map(d => ({ id: d.id, ...toObj(d) }))
    .filter(g => g.is_active)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function createGoal(uid, goal) {
  const ref = userRef(uid).collection('goals').doc();
  await ref.set({ ...goal, is_active: true, created_at: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  return { id: ref.id, ...toObj(snap) };
}

async function deleteGoal(uid, goalId) {
  const ref = userRef(uid).collection('goals').doc(goalId);
  const snap = await ref.get();
  if (!snap.exists) return { changes: 0 };
  await ref.update({ is_active: false });
  return { changes: 1 };
}

// --- Sinking Funds ---

async function getSinkingFunds(uid) {
  const snap = await userRef(uid).collection('sinking_funds').orderBy('created_at', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
}

async function addSinkingFund(uid, fund) {
  const ref = userRef(uid).collection('sinking_funds').doc();
  await ref.set({ ...fund, created_at: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  return { id: ref.id, ...toObj(snap) };
}

async function deleteSinkingFund(uid, fundId) {
  const ref = userRef(uid).collection('sinking_funds').doc(fundId);
  const snap = await ref.get();
  if (!snap.exists) return { changes: 0 };
  await ref.delete();
  return { changes: 1 };
}

// --- AI Insights ---

async function getLatestInsight(uid) {
  const snap = await userRef(uid).collection('insights')
    .orderBy('generated_at', 'desc').limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...toObj(doc) };
}

async function saveInsight(uid, insight) {
  const ref = userRef(uid).collection('insights').doc();
  await ref.set({ insight, generated_at: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  return { id: ref.id, ...toObj(snap) };
}

async function getUsage(uid, yearMonth) {
  const snap = await userRef(uid).collection('ai_usage').doc(yearMonth).get();
  return snap.exists ? snap.data() : null;
}

async function incrementUsage(uid, yearMonth) {
  const ref = userRef(uid).collection('ai_usage').doc(yearMonth);
  await ref.set({ year_month: yearMonth, count: FieldValue.increment(1) }, { merge: true });
}

// --- Budgets ---

async function getBudgets(uid) {
  const snap = await userRef(uid).collection('budgets').orderBy('created_at', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
}

async function upsertBudget(uid, budgetId, data) {
  const ref = budgetId
    ? userRef(uid).collection('budgets').doc(budgetId)
    : userRef(uid).collection('budgets').doc();
  await ref.set({ ...data, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  if (!data.created_at) await ref.set({ created_at: FieldValue.serverTimestamp() }, { merge: true });
  const snap = await ref.get();
  return { id: ref.id, ...toObj(snap) };
}

async function deleteBudget(uid, budgetId) {
  const ref = userRef(uid).collection('budgets').doc(budgetId);
  const snap = await ref.get();
  if (!snap.exists) return { changes: 0 };
  await ref.delete();
  return { changes: 1 };
}

// --- Dashboard Config ---

const DEFAULT_DASHBOARD_WIDGETS = [
  'debt_projection', 'net_worth_trend', 'spending_by_category',
  'goals_progress', 'interest_cost', 'savings_rate',
  'priority_attack', 'ai_insights', 'alerts',
];

async function getDashboardConfig(uid) {
  const snap = await userRef(uid).collection('dashboard_config').doc('default').get();
  if (!snap.exists) return { widgets: DEFAULT_DASHBOARD_WIDGETS };
  return { widgets: snap.data().widgets || DEFAULT_DASHBOARD_WIDGETS };
}

async function saveDashboardConfig(uid, widgets) {
  await userRef(uid).collection('dashboard_config').doc('default').set({
    widgets,
    updated_at: FieldValue.serverTimestamp(),
  });
}

// --- Net Worth History ---

async function recordNetWorthSnapshot(uid, accounts) {
  const assetTypes     = ['depository', 'investment', 'brokerage'];
  const liabilityTypes = ['credit', 'loan', 'mortgage'];

  const plaidAssets      = accounts.filter(a => assetTypes.includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const totalLiabilities = accounts.filter(a => liabilityTypes.includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);

  // Include non-archived manual assets (real estate, vehicles, stocks & bonds, etc.)
  // so the historical series matches the live net worth total.
  // Fetch all and filter in JS — archived_at is absent (not null) on new docs.
  const manualSnap   = await userRef(uid).collection('manual_assets').get();
  const manualAssets = manualSnap.docs
    .filter(d => !d.data().archived_at)
    .reduce((s, d) => s + (d.data().current_value || 0), 0);

  const totalAssets = plaidAssets + manualAssets;
  const netWorth    = totalAssets - totalLiabilities;

  const yearMonth = new Date().toISOString().slice(0, 7);
  const ref = userRef(uid).collection('net_worth_history').doc(yearMonth);
  await ref.set({
    total_assets:      Math.round(totalAssets * 100) / 100,
    total_liabilities: Math.round(totalLiabilities * 100) / 100,
    net_worth:         Math.round(netWorth * 100) / 100,
    recorded_at:       FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function getNetWorthHistory(uid, limit = 12) {
  const snap = await userRef(uid).collection('net_worth_history').get();
  const docs = snap.docs.map(d => ({ month: d.id, ...toObj(d) }));
  docs.sort((a, b) => a.month.localeCompare(b.month));
  return docs.slice(-limit);
}

// --- Manual Assets ---

async function getManualAssets(uid, { includeArchived = false } = {}) {
  const snap = await userRef(uid).collection('manual_assets').orderBy('created_at', 'desc').get();
  const all  = snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
  return includeArchived ? all : all.filter(a => !a.archived_at);
}

async function archiveManualAsset(uid, id) {
  await userRef(uid).collection('manual_assets').doc(id).update({
    archived_at: FieldValue.serverTimestamp(),
  });
}

async function archivePlaidAccount(uid, accountId) {
  await userRef(uid).collection('accounts').doc(accountId).update({
    archived_at: FieldValue.serverTimestamp(),
  });
}

async function archivePlaidItem(uid, itemId) {
  const now = FieldValue.serverTimestamp();
  await userRef(uid).collection('plaid_items').doc(itemId).update({ archived_at: now });

  // Batch-archive all accounts that belong to this item
  const snap = await userRef(uid).collection('accounts')
    .where('plaid_item_id', '==', itemId).get();
  if (!snap.empty) {
    const batch = firestore.batch();
    snap.docs.forEach(d => batch.update(d.ref, { archived_at: now }));
    await batch.commit();
  }
}

async function addManualAsset(uid, data) {
  const ref = userRef(uid).collection('manual_assets').doc();
  await ref.set({ ...data, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
  return ref.id;
}

async function updateManualAsset(uid, id, data) {
  await userRef(uid).collection('manual_assets').doc(id).update({ ...data, updated_at: FieldValue.serverTimestamp() });
}

async function deleteManualAsset(uid, id) {
  await userRef(uid).collection('manual_assets').doc(id).delete();
}

// --- Investment Holdings ---

async function saveHoldings(uid, holdings, securities) {
  const secMap = {};
  for (const s of securities) secMap[s.security_id] = s;

  const docs = holdings.map(h => {
    const sec = secMap[h.security_id] || {};
    return {
      id:                 `${h.account_id}_${h.security_id}`,
      account_id:         h.account_id,
      security_id:        h.security_id,
      name:               sec.name               || 'Unknown',
      ticker_symbol:      sec.ticker_symbol       || null,
      security_type:      sec.type               || 'equity',
      quantity:           h.quantity             ?? 0,
      institution_value:  h.institution_value    ?? 0,
      cost_basis:         h.cost_basis           ?? null,
      close_price:        sec.close_price ?? h.institution_price ?? null,
      iso_currency_code:  sec.iso_currency_code  || 'USD',
      updated_at:         FieldValue.serverTimestamp(),
    };
  });

  for (let i = 0; i < docs.length; i += 500) {
    const batch = firestore.batch();
    docs.slice(i, i + 500).forEach(d => {
      const ref = userRef(uid).collection('investment_holdings').doc(d.id);
      const { id, ...data } = d;
      batch.set(ref, data, { merge: true });
    });
    await batch.commit();
  }
}

async function getHoldings(uid) {
  const snap = await userRef(uid).collection('investment_holdings').orderBy('institution_value', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
}

// --- Admin ---

async function getAllUsers() {
  const snap = await firestore.collection('users').get();
  return snap.docs.map(d => ({ uid: d.id, ...toObj(d) }));
}

async function deleteUserData(uid) {
  const subs = ['accounts', 'transactions', 'goals', 'sinking_funds', 'insights', 'ai_usage', 'plaid_items', 'payoff_plans', 'budgets'];
  for (const sub of subs) {
    const snap = await userRef(uid).collection(sub).get();
    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = firestore.batch();
      snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await userRef(uid).delete();
}

module.exports = {
  admin, firestore, FieldValue, userRef, init,
  getUser, upsertUser,
  getAccountsByUser, upsertAccount,
  getPlaidItems, upsertPlaidItem,
  saveTransactions, deleteTransactions, getTransactionsByUser, getTransactionSummary,
  getPayoffPlan, savePlan,
  getGoals, createGoal, deleteGoal,
  getSinkingFunds, addSinkingFund, deleteSinkingFund,
  getLatestInsight, saveInsight, getUsage, incrementUsage,
  getAllUsers, deleteUserData,
  getBudgets, upsertBudget, deleteBudget,
  recordNetWorthSnapshot, getNetWorthHistory,
  getDashboardConfig, saveDashboardConfig,
  getManualAssets, addManualAsset, updateManualAsset, deleteManualAsset, archiveManualAsset,
  archivePlaidItem, archivePlaidAccount,
  saveHoldings, getHoldings,
};
