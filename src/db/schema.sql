CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  monthly_income REAL,
  monthly_expenses REAL,
  strategy TEXT NOT NULL DEFAULT 'avalanche' CHECK(strategy IN ('avalanche', 'snowball', 'hybrid', 'highestPaymentRatio')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plaid_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  access_token TEXT NOT NULL,
  item_id TEXT UNIQUE NOT NULL,
  institution_name TEXT,
  institution_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plaid_item_id INTEGER NOT NULL REFERENCES plaid_items(id),
  plaid_account_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('credit', 'depository')),
  balance_current REAL,
  balance_available REAL,
  credit_limit REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER UNIQUE NOT NULL REFERENCES accounts(id),
  apr REAL,
  is_promotional_apr INTEGER DEFAULT 0,
  promo_apr_expiry_date TEXT,
  minimum_payment REAL,
  payment_due_date TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payoff_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  strategy TEXT NOT NULL,
  total_debt REAL,
  monthly_interest REAL,
  surplus REAL,
  debt_free_estimate TEXT,
  insight TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  goal_type TEXT NOT NULL CHECK(goal_type IN ('debt_free_date', 'card_payoff', 'balance_target')),
  target_date TEXT,
  target_balance REAL,
  account_id INTEGER REFERENCES accounts(id),
  label TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  insight TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id),
  year_month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);

CREATE TABLE IF NOT EXISTS plan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payoff_plan_id INTEGER NOT NULL REFERENCES payoff_plans(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  priority_order INTEGER NOT NULL,
  estimated_payoff_month TEXT,
  monthly_interest REAL,
  notes TEXT
);
