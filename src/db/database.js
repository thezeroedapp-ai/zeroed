const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../zeroed.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function init() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  getDb().exec(schema);
  console.log('Database initialized at', DB_PATH);
}

// --- users ---

const getUser = (() => {
  let stmt;
  return (id) => {
    const db = getDb();
    stmt = stmt || db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  };
})();

// --- accounts ---

const upsertAccount = (() => {
  let stmt;
  return (account) => {
    const db = getDb();
    stmt = stmt || db.prepare(`
      INSERT INTO accounts (plaid_item_id, plaid_account_id, name, type, balance_current, balance_available, credit_limit, updated_at)
      VALUES (@plaid_item_id, @plaid_account_id, @name, @type, @balance_current, @balance_available, @credit_limit, CURRENT_TIMESTAMP)
      ON CONFLICT(plaid_account_id) DO UPDATE SET
        name             = excluded.name,
        balance_current  = excluded.balance_current,
        balance_available= excluded.balance_available,
        credit_limit     = excluded.credit_limit,
        updated_at       = CURRENT_TIMESTAMP
    `);
    return stmt.run(account);
  };
})();

// --- transactions ---

const saveTransactions = (() => {
  let stmt;
  return (transactions) => {
    const db = getDb();
    stmt = stmt || db.prepare(`
      INSERT OR IGNORE INTO transactions (account_id, plaid_transaction_id, date, description, amount, category)
      VALUES (@account_id, @plaid_transaction_id, @date, @description, @amount, @category)
    `);
    const insertMany = db.transaction((rows) => {
      for (const row of rows) stmt.run(row);
    });
    insertMany(transactions);
  };
})();

// --- payoff plans ---

const getPayoffPlan = (() => {
  let planStmt, itemsStmt;
  return (userId) => {
    const db = getDb();
    planStmt = planStmt || db.prepare(`
      SELECT * FROM payoff_plans WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1
    `);
    itemsStmt = itemsStmt || db.prepare(`
      SELECT pi.*, a.name AS account_name, a.balance_current, a.credit_limit
      FROM plan_items pi
      JOIN accounts a ON a.id = pi.account_id
      WHERE pi.payoff_plan_id = ?
      ORDER BY pi.priority_order
    `);
    const plan = planStmt.get(userId);
    if (!plan) return null;
    plan.items = itemsStmt.all(plan.id);
    return plan;
  };
})();

const savePlan = (() => {
  let planStmt, itemStmt;
  return (plan) => {
    const db = getDb();
    planStmt = planStmt || db.prepare(`
      INSERT INTO payoff_plans (user_id, strategy, total_debt, monthly_interest, surplus, debt_free_estimate)
      VALUES (@user_id, @strategy, @total_debt, @monthly_interest, @surplus, @debt_free_estimate)
    `);
    itemStmt = itemStmt || db.prepare(`
      INSERT INTO plan_items (payoff_plan_id, account_id, priority_order, estimated_payoff_month, monthly_interest, notes)
      VALUES (@payoff_plan_id, @account_id, @priority_order, @estimated_payoff_month, @monthly_interest, @notes)
    `);
    const insert = db.transaction((p) => {
      const { lastInsertRowid } = planStmt.run(p);
      for (const item of p.items) {
        itemStmt.run({ ...item, payoff_plan_id: lastInsertRowid });
      }
      return lastInsertRowid;
    });
    return insert(plan);
  };
})();

module.exports = { getDb, init, getUser, upsertAccount, saveTransactions, getPayoffPlan, savePlan };
