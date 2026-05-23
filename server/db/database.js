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

async function getAccountsByUser(uid) {
  const snap = await userRef(uid).collection('accounts').get();
  return snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
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

// --- Sinking Funds (Expenses) ---

async function getExpenses(uid) {
  const snap = await userRef(uid).collection('expenses').orderBy('created_at', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...toObj(d) }));
}

async function addExpense(uid, expense) {
  const ref = userRef(uid).collection('expenses').doc();
  await ref.set({ ...expense, created_at: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  return { id: ref.id, ...toObj(snap) };
}

async function deleteExpense(uid, expenseId) {
  const ref = userRef(uid).collection('expenses').doc(expenseId);
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

// --- Admin ---

async function getAllUsers() {
  const snap = await firestore.collection('users').get();
  return snap.docs.map(d => ({ uid: d.id, ...toObj(d) }));
}

async function deleteUserData(uid) {
  const subs = ['accounts', 'transactions', 'goals', 'expenses', 'insights', 'ai_usage', 'plaid_items', 'payoff_plans', 'budgets'];
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
  saveTransactions, getTransactionsByUser, getTransactionSummary,
  getPayoffPlan, savePlan,
  getGoals, createGoal, deleteGoal,
  getExpenses, addExpense, deleteExpense,
  getLatestInsight, saveInsight, getUsage, incrementUsage,
  getAllUsers, deleteUserData,
  getBudgets, upsertBudget, deleteBudget,
};
