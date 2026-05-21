require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

// --- Helpers ---

async function query(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}

async function queryOne(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function init() {
  await pool.query('SELECT 1');
  console.log('Database connected:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost');
}

// --- Users ---

async function getUser(id) {
  return queryOne('SELECT * FROM users WHERE id = $1', [id]);
}

// --- Accounts ---

async function upsertAccount(account) {
  await pool.query(`
    INSERT INTO accounts
      (plaid_item_id, plaid_account_id, name, type, balance_current, balance_available, credit_limit, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT(plaid_account_id) DO UPDATE SET
      name              = EXCLUDED.name,
      balance_current   = EXCLUDED.balance_current,
      balance_available = EXCLUDED.balance_available,
      credit_limit      = EXCLUDED.credit_limit,
      updated_at        = NOW()
  `, [
    account.plaid_item_id, account.plaid_account_id, account.name, account.type,
    account.balance_current, account.balance_available, account.credit_limit,
  ]);
}

// --- Transactions ---

async function saveTransactions(transactions) {
  if (!transactions.length) return;
  return withTransaction(async (client) => {
    for (const t of transactions) {
      await client.query(`
        INSERT INTO transactions
          (account_id, plaid_transaction_id, date, description, amount, category)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(plaid_transaction_id) DO NOTHING
      `, [t.account_id, t.plaid_transaction_id, t.date, t.description, t.amount, t.category]);
    }
  });
}

// --- Payoff plans ---

async function getPayoffPlan(userId) {
  const plan = await queryOne(
    'SELECT * FROM payoff_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1',
    [userId]
  );
  if (!plan) return null;
  plan.items = await query(`
    SELECT pi.*, a.name AS account_name, a.balance_current, a.credit_limit
    FROM plan_items pi
    JOIN accounts a ON a.id = pi.account_id
    WHERE pi.payoff_plan_id = $1
    ORDER BY pi.priority_order
  `, [plan.id]);
  return plan;
}

async function savePlan(plan) {
  return withTransaction(async (client) => {
    const { rows: [p] } = await client.query(`
      INSERT INTO payoff_plans
        (user_id, strategy, total_debt, monthly_interest, surplus, debt_free_estimate, insight)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [plan.user_id, plan.strategy, plan.total_debt, plan.monthly_interest,
        plan.surplus, plan.debt_free_estimate, plan.insight]);

    for (const item of plan.items) {
      await client.query(`
        INSERT INTO plan_items
          (payoff_plan_id, account_id, priority_order, estimated_payoff_month, monthly_interest, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [p.id, item.account_id, item.priority_order,
          item.estimated_payoff_month, item.monthly_interest, item.notes]);
    }
    return p.id;
  });
}

// --- Goals ---

async function getGoals(userId) {
  return query(`
    SELECT g.*, a.name as account_name, a.balance_current as account_balance
    FROM user_goals g
    LEFT JOIN accounts a ON a.id = g.account_id
    WHERE g.user_id = $1 AND g.is_active = 1
    ORDER BY g.created_at DESC
  `, [userId]);
}

async function createGoal(goal) {
  return queryOne(`
    INSERT INTO user_goals (user_id, goal_type, target_date, target_balance, account_id, label)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [goal.user_id, goal.goal_type, goal.target_date, goal.target_balance, goal.account_id, goal.label]);
}

async function deleteGoal(id, userId) {
  const { rowCount } = await pool.query(
    'UPDATE user_goals SET is_active = 0 WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return { changes: rowCount };
}

// --- Sinking funds ---

async function getExpenses(userId) {
  return query('SELECT * FROM user_expenses WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
}

async function addExpense(expense) {
  return queryOne(`
    INSERT INTO user_expenses (user_id, name, amount, category)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [expense.user_id, expense.name, expense.amount, expense.category]);
}

async function deleteExpense(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM user_expenses WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return { changes: rowCount };
}

// --- AI insights ---

async function getLatestInsight(userId) {
  return queryOne(
    'SELECT * FROM user_insights WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1',
    [userId]
  );
}

async function saveInsight(userId, insight) {
  return queryOne(
    'INSERT INTO user_insights (user_id, insight) VALUES ($1, $2) RETURNING *',
    [userId, insight]
  );
}

async function getUsage(userId, yearMonth) {
  return queryOne(
    'SELECT count FROM ai_usage WHERE user_id = $1 AND year_month = $2',
    [userId, yearMonth]
  );
}

async function incrementUsage(userId, yearMonth) {
  await pool.query(`
    INSERT INTO ai_usage (user_id, year_month, count) VALUES ($1, $2, 1)
    ON CONFLICT(user_id, year_month) DO UPDATE SET count = ai_usage.count + 1
  `, [userId, yearMonth]);
}

module.exports = {
  pool, query, queryOne, withTransaction,
  init, getUser,
  upsertAccount, saveTransactions,
  getPayoffPlan, savePlan,
  getGoals, createGoal, deleteGoal,
  getExpenses, addExpense, deleteExpense,
  getLatestInsight, saveInsight, getUsage, incrementUsage,
};
