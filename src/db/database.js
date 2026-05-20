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
  const db = getDb();
  db.exec(schema);
  // Migrations for existing databases
  const migrations = [
    "ALTER TABLE payoff_plans ADD COLUMN insight TEXT",
    "ALTER TABLE users ADD COLUMN strategy TEXT NOT NULL DEFAULT 'avalanche'",
    "ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS user_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      insight TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ai_usage (
      user_id INTEGER NOT NULL REFERENCES users(id),
      year_month TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, year_month)
    )`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }
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
      INSERT INTO payoff_plans (user_id, strategy, total_debt, monthly_interest, surplus, debt_free_estimate, insight)
      VALUES (@user_id, @strategy, @total_debt, @monthly_interest, @surplus, @debt_free_estimate, @insight)
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

// --- goals ---

function getGoals(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT g.*, a.name as account_name, a.balance_current as account_balance
    FROM user_goals g
    LEFT JOIN accounts a ON a.id = g.account_id
    WHERE g.user_id = ? AND g.is_active = 1
    ORDER BY g.created_at DESC
  `).all(userId);
}

function createGoal(goal) {
  const db = getDb();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO user_goals (user_id, goal_type, target_date, target_balance, account_id, label)
    VALUES (@user_id, @goal_type, @target_date, @target_balance, @account_id, @label)
  `).run(goal);
  return db.prepare('SELECT * FROM user_goals WHERE id = ?').get(lastInsertRowid);
}

function deleteGoal(id, userId) {
  return getDb().prepare('UPDATE user_goals SET is_active = 0 WHERE id = ? AND user_id = ?').run(id, userId);
}

// --- ai insights ---

function getLatestInsight(userId) {
  return getDb().prepare(
    'SELECT * FROM user_insights WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1'
  ).get(userId);
}

function saveInsight(userId, insight) {
  const db = getDb();
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO user_insights (user_id, insight) VALUES (?, ?)'
  ).run(userId, insight);
  return db.prepare('SELECT * FROM user_insights WHERE id = ?').get(lastInsertRowid);
}

function getUsage(userId, yearMonth) {
  return getDb().prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND year_month = ?'
  ).get(userId, yearMonth);
}

function incrementUsage(userId, yearMonth) {
  getDb().prepare(`
    INSERT INTO ai_usage (user_id, year_month, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, year_month) DO UPDATE SET count = count + 1
  `).run(userId, yearMonth);
}

// --- user_expenses ---

function getExpenses(userId) {
  return getDb().prepare('SELECT * FROM user_expenses WHERE user_id = ? ORDER BY created_at ASC').all(userId);
}

function addExpense(expense) {
  const db = getDb();
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO user_expenses (user_id, name, amount, category) VALUES (@user_id, @name, @amount, @category)'
  ).run(expense);
  return db.prepare('SELECT * FROM user_expenses WHERE id = ?').get(lastInsertRowid);
}

function deleteExpense(id, userId) {
  return getDb().prepare('DELETE FROM user_expenses WHERE id = ? AND user_id = ?').run(id, userId);
}

module.exports = { getDb, init, getUser, upsertAccount, saveTransactions, getPayoffPlan, savePlan, getGoals, createGoal, deleteGoal, getExpenses, addExpense, deleteExpense, getLatestInsight, saveInsight, getUsage, incrementUsage };
