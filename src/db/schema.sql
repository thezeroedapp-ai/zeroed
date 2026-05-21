-- Zeroed — PostgreSQL schema
-- Run this once in the Supabase SQL Editor before starting the server.
-- Safe to re-run: all statements use CREATE TABLE IF NOT EXISTS / IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS users (
  id               BIGSERIAL PRIMARY KEY,
  auth_id          TEXT UNIQUE,              -- Supabase Auth UUID (auth.users.id)
  name             TEXT NOT NULL DEFAULT '',
  email            TEXT UNIQUE NOT NULL,
  monthly_income   NUMERIC,
  monthly_expenses NUMERIC,
  strategy         TEXT NOT NULL DEFAULT 'avalanche'
                   CHECK(strategy IN ('avalanche','snowball','hybrid','highestPaymentRatio')),
  is_pro           INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a user profile row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, email)
  VALUES (
    new.id::TEXT,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

CREATE TABLE IF NOT EXISTS plaid_items (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  access_token     TEXT NOT NULL,
  item_id          TEXT UNIQUE NOT NULL,
  institution_name TEXT,
  institution_id   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                BIGSERIAL PRIMARY KEY,
  plaid_item_id     BIGINT NOT NULL REFERENCES plaid_items(id),
  plaid_account_id  TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK(type IN ('credit','depository')),
  balance_current   NUMERIC,
  balance_available NUMERIC,
  credit_limit      NUMERIC,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_details (
  id                    BIGSERIAL PRIMARY KEY,
  account_id            BIGINT UNIQUE NOT NULL REFERENCES accounts(id),
  apr                   NUMERIC,
  is_promotional_apr    INTEGER DEFAULT 0,
  promo_apr_expiry_date TEXT,
  minimum_payment       NUMERIC,
  payment_due_date      TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id                   BIGSERIAL PRIMARY KEY,
  account_id           BIGINT NOT NULL REFERENCES accounts(id),
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  date                 TEXT NOT NULL,
  description          TEXT,
  amount               NUMERIC NOT NULL,
  category             TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payoff_plans (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  strategy          TEXT NOT NULL,
  total_debt        NUMERIC,
  monthly_interest  NUMERIC,
  surplus           NUMERIC,
  debt_free_estimate TEXT,
  insight           TEXT,
  generated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_items (
  id                     BIGSERIAL PRIMARY KEY,
  payoff_plan_id         BIGINT NOT NULL REFERENCES payoff_plans(id),
  account_id             BIGINT NOT NULL REFERENCES accounts(id),
  priority_order         INTEGER NOT NULL,
  estimated_payoff_month TEXT,
  monthly_interest       NUMERIC,
  notes                  TEXT
);

CREATE TABLE IF NOT EXISTS user_goals (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  goal_type      TEXT NOT NULL CHECK(goal_type IN ('debt_free_date','card_payoff','balance_target')),
  target_date    TEXT,
  target_balance NUMERIC,
  account_id     BIGINT REFERENCES accounts(id),
  label          TEXT,
  is_active      INTEGER DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_expenses (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  amount     NUMERIC NOT NULL,
  category   TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_insights (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  insight      TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id    BIGINT NOT NULL REFERENCES users(id),
  year_month TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);
