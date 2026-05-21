# Zeroed — Dev Log

> One entry per work session. Log what was built, what was decided, and what's next. Keep this updated — it's the running history of how the product evolved and why decisions were made.

---

## 2026-05-20

### v1.0 — Initial Build

**Built:**
- Express backend with Plaid API v29 integration (sandbox mode)
- SQLite database with `better-sqlite3`
- 5 screens: Dashboard, Plan, Accounts, Activity, Settings
- 4 payoff strategies: Avalanche, Snowball, Hybrid, Cash Flow with freed-minimum rollover
- Daily Plaid sync cron at 8am
- Dev seed data: 5 realistic credit card accounts, no Plaid credentials required
- Mobile-first PWA design, 480px max-width

**Decisions:**
- Single-user for now (user_id = 1 hardcoded) — multi-user deferred to Phase 2
- SQLite chosen for simplicity in early dev; migration to Supabase planned from day one
- Node.js stays (not Python) — backend language doesn't affect platform support, rewrite would cost weeks for zero user-facing benefit

---

### v1.1 — Payoff Strategies + Goals

**Built:**
- 4-strategy grid UI on Plan screen
- Lump-sum payment simulator (shows months saved + interest saved)
- Goals screen: debt-free date, per-card payoff, balance target goal types
- Required-payment calculator: binary search to find exact extra payment needed for any target date

---

### v1.2 — Sinking Funds

**Built:**
- Sinking funds manager in Settings — reserve monthly amounts for known future expenses
- Categories: car, home, medical, travel, education, holiday, tax, other
- Sinking fund total automatically subtracted from surplus in all calculations: dashboard, plan, lump-sum, required-payment
- Settings fixes: version number bump, category dropdown reset after adding, delete confirmation guard

**Why sinking funds matter:** Without them, the surplus is overstated and the payoff plan always slips. e.g. $1,200/yr car registration = $100/mo less available for debt.

---

### v1.3 — AI Spending Insights + Manual APR

**Built:**
- AI spending analysis card on Dashboard (not Plan — more visible there, where users land first)
- Sends 90-day transaction category breakdown + full debt profile to Claude (`claude-sonnet-4-6`)
- Returns exactly 3 numbered insights, cached in `user_insights` table
- Freemium gate: 10 free analyses/month tracked in `ai_usage` table; `is_pro` flag bypasses limit
- `GET /api/insights/latest` — returns cached insight + usage stats
- `POST /api/insights/generate` — checks limit, calls Claude, increments usage
- Manual APR inline edit on Accounts page — `PUT /api/plaid/accounts/:id/credit-details`
- Warning badge when APR or minimum payment is missing (Plaid sometimes omits these)

**Decisions:**
- AI costs accumulate to us (app owner via Anthropic API key); passed to users via freemium gate
- Stripe + auth deferred to Phase 2; manual Pro upgrade via SQL (`UPDATE users SET is_pro = true`) for now
- 10/month free tier — low enough to control costs, high enough to be useful for active users
- Insight kept on Dashboard so users see it without navigating to Plan

---

### v1.4 — Card Recommendation Engine *(pulled from second machine)*

**Built:**
- `cardProfiles.js` — 10 curated card profiles with `nameKeywords`, `centsPerPoint`, per-category `multipliers`
- `recommendationEngine.js` — `effectiveRate = multiplier × centsPerPoint`; 50% debt penalty for cards with active balances
- `GET /api/recommendations?category=dining&amount=50` — ranked results
- `GET /api/recommendations/categories` — category list with icons and `profilesLastUpdated` date
- Reward screen: category picker + ranked card list

**Decisions:**
- Cards with active debt ranked lower (`DEBT_PENALTY_FACTOR = 0.5`) to discourage points chasing while in debt — the math never favors rewards over 20%+ APR interest
- TPG (The Points Guy) valuations used for `centsPerPoint`; update quarterly
- `PROFILES_LAST_UPDATED` exposed in the API so the UI can show freshness

---

### v2.0 — PostgreSQL/Supabase Migration + GitHub Org

**Built:**
- Full database migration from SQLite (`better-sqlite3`) to PostgreSQL (`pg`)
- New `src/db/schema.sql`: BIGSERIAL, TIMESTAMPTZ, NUMERIC, ON CONFLICT DO NOTHING — Supabase-native
- `database.js` rewritten: `query(text, params)`, `queryOne(text, params)`, `withTransaction(fn)` helpers; all async
- All routes + `server.js` + `plaidService.js` converted from sync to async/await
- SQL params changed from `?`/`@name` to `$1,$2,...` throughout
- SSL configured: `rejectUnauthorized: false` when DATABASE_URL isn't localhost (Supabase requirement)
- `pg` aggregate functions return strings — added `parseFloat()` where needed (e.g. `SUM(amount)` in insights)
- `ROUND(SUM(amount), 2)` → `ROUND(SUM(amount)::numeric, 2)` for explicit PostgreSQL cast

**Infrastructure changes:**
- Project email created: `thezeroedapp@gmail.com` — use this for all service accounts (Supabase, Plaid, Anthropic, Stripe, GitHub)
- GitHub org created: `thezeroedapp-ai`
- Repo migrated from `venkatbade/Zeroed` → `https://github.com/thezeroedapp-ai/zeroed`
- Old personal remote revoked and replaced with org remote

**Decisions:**
- No SQLite fallback — all-in on Supabase; hybrid complexity not worth it
- Schema run manually in Supabase SQL Editor (not auto-applied at startup) — keeps startup simple and prevents accidental re-runs
- Still single-user (user_id = 1 hardcoded) — multi-user auth is Phase 2, needs Supabase Auth wired up first
- Separate project email keeps personal and product accounts cleanly separated for future team access

**What's next:**
1. Connect Supabase project (create project → run `schema.sql` → add `DATABASE_URL` to `.env`)
2. Test the full app end-to-end with Supabase
3. Multi-user auth: Supabase Auth, JWT scoping, remove hardcoded user_id = 1

---
