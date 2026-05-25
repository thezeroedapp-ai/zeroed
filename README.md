# Zeroed — Debt Payoff & Net Worth Tracker

> **Keep this README updated.** After every dev session, update Current Status and Changelog. The README is the single source of truth for where the project stands.

The goal of Zeroed is simple: **know exactly when you'll be debt-free, and take the fastest path there.**

Most people with credit card debt make minimum payments, get hit with interest, and never see the finish line. Zeroed connects to your real bank accounts, surfaces your actual APRs and balances, and runs a month-by-month simulation showing the optimal attack order, your exact debt-free date, and how much interest you save by throwing even $100/mo extra at it.

Built as a mobile-first React PWA. Backend runs on Firebase Cloud Functions.

**Live at: [https://zeroed-3331d.web.app](https://zeroed-3331d.web.app)**

---

## Current Status

**v8.1 — CSS card art system with per-product gradients and network badges** *(2026-05-25)*

- **Card art registry:** `card-designs.ts` contains ~80 entries covering every major US credit card product — Amex (Platinum, Gold, Green, Delta, Hilton, Marriott, Blue Cash), Chase (Sapphire Reserve/Preferred, Freedom family, Ink family, United, Southwest, Hyatt), Citi (Double Cash, Custom Cash, Premier, Prestige), Capital One (Venture X, Venture, Quicksilver, Savor, Spark), BofA, Wells Fargo, Discover, US Bank, PNC, TD, Truist, Navy Federal, USAA, Apple Card, Bilt, Amazon, Target, Costco, PayPal, Walmart, and more. First keyword match wins; returns `null` for unknowns so brand-color fallback still works.
- **Network badges:** Inline Visa/Mastercard/Amex/Discover logos — Mastercard as two overlapping SVG circles in exact brand colors, others as styled text. Zero CDN dependencies, scales cleanly at any chip size.
- **Updated chip:** `CreditCardChip` now uses the registry — matched cards get product-specific gradient + shimmer type (`glossy` or `brushed` metal texture) + network badge. Unmatched cards fall back to brand-color chip + logo.dev institution logo (no regression). Apple Card renders with dark decorations on its white titanium surface.

---

## Changelog

| Version | Date | What shipped |
|---------|------|--------------|
| v8.1 | 2026-05-25 | CSS card art system: ~80-entry card design registry with per-product gradients; inline network badges (Visa/Mastercard/Amex/Discover); brushed-metal shimmer for premium cards; Apple Card white/titanium with dark decorations; graceful fallback chain for unknown cards |
| v8.0 | 2026-05-25 | Institution logos via logo.dev (70+ institutions, brand-color fallback); CreditCardChip CSS mini-card on all credit account rows + Dashboard priority card; Plaid Investments product enabled, holdings sync + /api/plaid/holdings endpoint, investment_holdings Firestore subcollection; Stocks & Bonds dual connect CTAs (Plaid + manual); Settings bank list upgraded from initials to InstitutionLogo |
| v7.0 | 2026-05-25 | Mantine purge complete (Sheet → Radix Dialog, Notifications → Sonner, tooltip stub); fixed critical Tailwind v4 CSS layer bug (unlayered `*{padding:0}` was killing every spacing utility); Dashboard col-1 Net Worth chart upgraded to 3-line (assets + liabilities + net worth), Allocation upgraded to 4-slice donut with legend; both navigate to /accounts on click; /api/dashboard returns assetsByCategory + liabilitiesByCategory; Accounts page redesigned to category-first layout with utilization bars; CLAUDE.md added with architecture and coding rules |
| v6.3 | 2026-05-25 | TypeScript build error fixes from v6.3 changes |
| v6.2 | 2026-05-24 | Bug fixes + code quality + glass removal: shared `AvatarCircle` component; fixed `Content-Type` on GET requests; fixed hardcoded white chart colors in light mode; NaN guard on edit form; replaced all `alert()`/`confirm()` with inline confirmation; renamed `insightPayload`; fixed Spending URL-based tabs; removed all glass morphism, backdrop-filter, body gradient, shadow variable system |
| v6.1 | 2026-05-24 | Layout spacing, sidebar contrast, nav active state |
| v6.0 | 2026-05-24 | UI redesign: Monarch-style spacing, typography, visual polish |
| v5.4 | 2026-05-23 | Dark mode card contrast, surface-2, border visibility; page title sizing; Settings spacing |
| v5.3 | 2026-05-23 | ThemeContext dark/light toggle with localStorage, html.dark class, no-flash init script, full light oklch palette |
| v5.2 | 2026-05-23 | shadcn/ui + Tailwind v4 migration: all pages rewritten, 15 shadcn components, oklch color system, lucide icons, drill-down Sheet panels |
| v5.1 | 2026-05-23 | dnd-kit drag-and-drop dashboard, DragOverlay, Firestore-backed widget config, demo seed script |
| v5.0 | 2026-05-23 | Net worth monthly snapshots, Dashboard widget manager, design system lock-in |
| v4.5 | 2026-05-23 | Plaid update mode, item disconnect with token revocation, cursor-based transactionsSync |
| v4.4 | 2026-05-23 | Cloud Functions Node 22 2nd Gen, firebase-functions v5, v2 API |
| v4.3 | 2026-05-23 | 5-tab nav consolidation, URL-based subtabs, `expenses`→`sinking_funds` rename |
| v4.2 | 2026-05-22 | All Plaid account types, net worth, budgets, spending trends, recurring detection, first Firebase deploy |
| v4.0 | 2026-05-22 | Firebase migration — replaced Railway + Supabase + PostgreSQL entirely |
| v3.x | 2026-05-21 | Monorepo, React + Vite + TypeScript, multi-user auth |
| v1–2 | 2026-05-20 | Initial build, SQLite → PostgreSQL → Supabase, core payoff engine, AI insights, card recommendations |

---

## What It Does

### Core Features

- **Dashboard** — Net worth hero (3-line chart: assets, liabilities, net worth), 4-slice allocation donut (Cash & Savings / Investments / Credit Cards / Loans), debt payoff projection, priority attack card, spending by category, AI insights, goals status, alerts
- **Plan › Strategy** — Four payoff strategies, freed-minimum rollover, lump-sum simulator, extra payment calculator, attack order with per-card payoff dates
- **Plan › Goals** — Debt-free date targets, per-card payoff goals, balance targets; required-payment calculator answers "what does it take to be free by [date]?"
- **Plan › AI Insights** — Claude-powered spending analysis, 10/month free with freemium gate
- **Accounts › Accounts** — Category-first layout: Cash & Savings, Investments, Credit Cards (with utilization bars + APR/min/due date badges), Loans & Mortgages; net worth summary strip; institution summary; inline APR/min edit
- **Accounts › Budget** — Per-category monthly spending limits with progress bars, add/remove budgets, overall summary strip
- **Accounts › Rewards** — Pick a spend category, get ranked card recommendations (TPG valuations, debt penalty for cards with balances)
- **Spending** — Transactions (filterable), 6-month trends chart, recurring subscription detection with annual cost
- **Settings** — Plaid bank connect/disconnect/sync, income profile, sinking funds

### Payoff Strategies

| Strategy | How it works | Best for |
|---|---|---|
| **Avalanche** | Highest APR first | Minimizing total interest (mathematically optimal) |
| **Snowball** | Lowest balance first | Motivation — quick wins build momentum |
| **Hybrid** | 60% APR + 40% balance | Balanced — good math and visible progress |
| **Cash Flow** | Highest min/balance ratio first | Freeing up monthly cash fastest |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite + TypeScript |
| UI components | shadcn/ui (Radix primitives) — Card, Button, Badge, Input, Select, Progress, Sheet, Tabs, ChartContainer |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`. CSS-first `@theme inline` with oklch color tokens. No other CSS frameworks. |
| Icons | lucide-react |
| Charts | Recharts wrapped by shadcn `ChartContainer` |
| Toasts | Sonner |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Database | Firestore (Firebase Admin SDK, server-side only) |
| API server | Express.js → Firebase Cloud Functions (Node 22, 2nd Gen) |
| Hosting | Firebase Hosting (SPA) + Cloud Functions (API) |
| Bank data | Plaid API v29 — Transactions + Liabilities + all account types |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Monorepo | npm workspaces |
| Deploy | `firebase deploy` (builds web + deploys Hosting + Functions + Firestore rules in one command) |

**Firebase project:** `zeroed-3331d`  
**Production URL:** [zeroed-3331d.web.app](https://zeroed-3331d.web.app)  
**Repository:** [github.com/thezeroedapp-ai/zeroed](https://github.com/thezeroedapp-ai/zeroed)

---

## Prerequisites

- **Node.js v22+**
- **Firebase project** — [console.firebase.google.com](https://console.firebase.google.com); enable Authentication (Email/Password + Google) and Firestore
- **Plaid account** — free sandbox at [dashboard.plaid.com](https://dashboard.plaid.com)
- **Anthropic API key** — optional, powers AI insights
- **Firebase CLI** — `npm install -g firebase-tools`

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/thezeroedapp-ai/zeroed.git
cd zeroed
npm install
```

### 2. Configure environment

Create a `.env` file at the project root:

```
# Firebase (server-side) — Firebase console → Project settings → Service accounts → Generate new private key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}  # paste JSON as single line

# Plaid — dashboard.plaid.com → Team Settings → Keys
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox

# AI insights (optional)
ANTHROPIC_API_KEY=sk-ant-...

PORT=3000
```

`apps/web/.env.local` (Firebase client config) is committed to git — no manual setup needed. Firebase client config is not secret.

Add a `VITE_LOGO_DEV_TOKEN` to `apps/web/.env.local` for institution logos:

```
# Logo.dev publishable key — safe to expose in frontend. Get from logo.dev dashboard.
VITE_LOGO_DEV_TOKEN=pk_...
```

Without this token, all institution logos fall back to colored initial avatars — the app still works.

### 3. Start local development

```bash
# Terminal 1 — Express backend on :3000
npm run dev

# Terminal 2 — Vite frontend on :5173 (proxies /api to :3000)
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173).

**UI-only mode (proxies API to production Firebase):**
```bash
npm run dev:web:remote
```

### 4. Deploy to Firebase

```bash
firebase login
npm run deploy   # builds React + deploys Hosting + Functions + Firestore rules
```

---

## Project Structure

```
zeroed/
├── server/
│   ├── index.js                    # Cloud Functions entry — exports.api + exports.dailySync
│   ├── server.js                   # Express app — all inline routes (dashboard, net-worth-history, etc.)
│   ├── db/
│   │   └── database.js             # Firestore CRUD — all data access goes through here
│   ├── middleware/
│   │   └── auth.js                 # Firebase token verification, auto-create user profile
│   ├── routes/
│   │   ├── plaid.js                # /api/plaid/* — link, exchange, sync, accounts, items
│   │   ├── plan.js                 # /api/plan/* — generate, latest, lump-sum, required-payment
│   │   ├── goals.js                # /api/goals — CRUD + live progress
│   │   ├── sinking-funds.js        # /api/sinking-funds — income + fund CRUD
│   │   ├── transactions.js         # /api/transactions — list, summary, trends, recurring
│   │   ├── budgets.js              # /api/budgets — CRUD + current-month spend enrichment
│   │   ├── insights.js             # /api/insights — AI analysis, freemium gate
│   │   ├── rewards.js              # /api/rewards — ranked card suggestions
│   │   └── admin.js                # /api/admin — admin-only tools
│   └── services/
│       ├── plaidService.js         # Plaid API — sync accounts + transactions (cursor-based)
│       ├── payoffEngine.js         # Pure math — 4 strategies, simulate, lump-sum, required-payment
│       ├── claudeService.js        # Claude API — plan insight + spending analysis
│       ├── cardProfiles.js         # Curated reward profiles — multipliers, TPG valuations
│       └── recommendationEngine.js # Ranking — effectiveRate calculation, debt penalty
├── apps/web/
│   ├── src/
│   │   ├── index.css               # Single CSS file — Tailwind import, oklch design tokens, base styles
│   │   ├── main.tsx                # Entry point — mounts App, imports index.css
│   │   ├── App.tsx                 # Routes + providers (ThemeProvider, AuthProvider, Toaster)
│   │   ├── lib/
│   │   │   ├── firebase.ts         # Firebase client SDK init (Auth only)
│   │   │   ├── api.ts              # apiFetch — attaches Firebase ID token to every request
│   │   │   └── institution-logos.ts # Runtime keyword→domain+brandColor map for 70+ institutions
│   │   ├── context/
│   │   │   ├── AuthContext.tsx     # onAuthStateChanged, user profile, signOut
│   │   │   └── ThemeContext.tsx    # Dark/light toggle — localStorage, html.dark class
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Wraps SideNav + main + BottomNav
│   │   │   ├── SideNav.tsx         # Desktop sidebar (5 tabs + theme toggle)
│   │   │   ├── BottomNav.tsx       # Mobile bottom nav (5 tabs)
│   │   │   ├── SubNav.tsx          # Reusable horizontal subtab bar
│   │   │   └── ui/                 # shadcn/ui primitives + institution-logo.tsx, credit-card-chip.tsx, avatar-circle.tsx
│   │   └── pages/
│   │       ├── Dashboard.tsx       # Home — 3-column grid, net worth, allocation, payoff, cash flow, AI
│   │       ├── Plan.tsx            # Strategy / Goals / AI Insights subtabs
│   │       ├── Accounts.tsx        # Accounts (category-first) / Budget / Rewards subtabs
│   │       ├── Spending.tsx        # Transactions / Trends / Recurring subtabs
│   │       ├── Settings.tsx        # Plaid connect, income, sinking funds, sign out
│   │       ├── Admin.tsx           # Admin-only user management
│   │       ├── Login.tsx           # Email/password + Google sign-in
│   │       └── Signup.tsx          # Registration
│   ├── .env.local                  # VITE_LOGO_DEV_TOKEN + Firebase client config (gitignored for token)
│   ├── index.html                  # Inline script prevents theme flash on load
│   ├── vite.config.ts              # Tailwind v4 vite plugin, /api proxy to :3000
│   └── tsconfig.app.json           # Strict TypeScript config
├── CLAUDE.md                       # AI coding rules, file map, tech constraints (read before coding)
├── firebase.json                   # Hosting + Functions + Firestore config
├── .firebaserc                     # Firebase project: zeroed-3331d
├── firestore.rules                 # Deny-all (Admin SDK bypasses rules)
├── firestore.indexes.json          # Composite indexes
└── package.json                    # npm workspaces root + build/deploy scripts
```

---

## API Reference

All `/api/*` routes require `Authorization: Bearer <Firebase ID token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/user` | User profile |
| PUT | `/api/user` | Update income, expenses, strategy |
| GET | `/api/dashboard` | Aggregated totals, alerts, priority card, debt-free date, category breakdowns |
| GET | `/api/net-worth-history` | Monthly net worth snapshots |
| GET | `/api/plaid/accounts` | All connected accounts |
| POST | `/api/plaid/create-link-token` | Start Plaid Link flow |
| POST | `/api/plaid/create-link-token/update` | Update mode (reconnect broken connection) |
| POST | `/api/plaid/exchange-token` | Complete Plaid Link, store access token |
| POST | `/api/plaid/sync` | Refresh balances + pull new transactions |
| GET | `/api/plaid/items` | Connected institutions (includes `error_status`) |
| DELETE | `/api/plaid/items/:itemId` | Disconnect bank — revokes Plaid token, deletes data |
| PUT | `/api/plaid/accounts/:id/credit-details` | Set APR, min payment, due date |
| DELETE | `/api/plaid/accounts/:id` | Remove single account |
| GET | `/api/plaid/holdings` | Investment holdings with security metadata |
| POST | `/api/plan/generate` | Run payoff engine + Claude insight, persist plan |
| GET | `/api/plan/latest` | Last saved plan |
| GET | `/api/plan/alerts` | Promo APR expiry + high utilization alerts |
| POST | `/api/plan/lump-sum` | Simulate one-time extra payment impact |
| POST | `/api/plan/required-payment` | Extra monthly needed to hit a target date |
| GET | `/api/goals` | All active goals with live progress |
| POST | `/api/goals` | Create a goal |
| DELETE | `/api/goals/:id` | Remove a goal |
| GET | `/api/transactions` | Transaction list |
| GET | `/api/transactions/summary` | Spending by category (last 30 days) |
| GET | `/api/transactions/trends` | 6-month spending by category (stacked chart data) |
| GET | `/api/transactions/recurring` | Recurring transactions from 2+ months of history |
| GET | `/api/budgets` | All budgets enriched with current-month spent/remaining/pct |
| POST | `/api/budgets` | Create budget (`category` + `monthly_limit`) |
| DELETE | `/api/budgets/:id` | Remove budget |
| GET | `/api/sinking-funds/income` | Saved monthly income |
| PUT | `/api/sinking-funds/income` | Update monthly income |
| GET | `/api/sinking-funds` | All sinking funds |
| POST | `/api/sinking-funds` | Add a sinking fund |
| DELETE | `/api/sinking-funds/:id` | Remove a sinking fund |
| GET | `/api/insights/latest` | Cached AI insight + usage stats |
| POST | `/api/insights/generate` | Generate AI spending insight (10/mo free limit) |
| GET | `/api/rewards/categories` | Spend categories with icons |
| GET | `/api/rewards?category=dining` | Ranked card recommendations |

---

## Firestore Schema

All user data lives under `users/{uid}/`:

| Subcollection | Document ID | Key fields |
|---|---|---|
| `accounts` | `plaid_account_id` | name, type (`depository`/`credit`/`investment`/`loan`/`mortgage`/`brokerage`), subtype, balance_current, apr, minimum_payment, credit_limit, payment_due_date, institution_name |
| `transactions` | `plaid_transaction_id` | account_id, amount, date, name, category |
| `goals` | auto | goal_type, target_date, target_balance, account_id, is_active |
| `sinking_funds` | auto | category, monthly_amount, label |
| `budgets` | auto | category, monthly_limit, created_at |
| `insights` | auto | content, created_at |
| `ai_usage` | `YYYY-MM` | count |
| `plaid_items` | `plaid_item_id` | access_token, institution_name, transactions_cursor, error_status, updated_at |
| `payoff_plans` | auto | strategy, surplus, items (embedded array) |
| `dashboard_config` | `default` | widgets (ordered string array) |
| `net_worth_history` | `YYYY-MM` | total_assets, total_liabilities, net_worth, recorded_at |
| `investment_holdings` | `{account_id}_{security_id}` | account_id, security_id, quantity, institution_value, name, ticker_symbol, type, institution_name |

---

## Payoff Engine

The engine (`server/services/payoffEngine.js`) runs entirely locally — no API calls.

**Core simulation:** Each month — accrue interest → pay all minimums → attack priority card with surplus. When a card pays off, its minimum **permanently joins** the attack budget (freed-minimum rollover).

**Lump-sum simulation:** Reduces a card's balance by the lump amount, then runs a normal simulation. Returns `monthsSaved` and `interestSaved` vs. baseline.

**Required-payment calculator:** Binary search (50 iterations) over the range `[0, totalDebt]` to find the minimum extra amount achieving `months ≤ targetMonths`.

---

## Connecting Real Banks (Plaid Sandbox)

In sandbox mode, use these fake credentials inside the Plaid Link widget:

- **Username:** `user_good`
- **Password:** `pass_good`

---

## Competitive Landscape

| Feature | Zeroed | Monarch | Origin |
|---|---|---|---|
| Debt payoff strategies | 4 (Avalanche, Snowball, Hybrid, Cash Flow) | Basic | Basic |
| Freed-minimum rollover | ✅ | ❌ | ❌ |
| Lump-sum simulator | ✅ | ❌ | ❌ |
| Required-payment calculator | ✅ | ❌ | ❌ |
| Card reward recommendations | ✅ | ❌ | ❌ |
| Freemium tier | ✅ 10 AI insights/mo free | ❌ | ❌ |
| Credit score monitoring | ❌ | ✅ | ❌ |
| Native iOS/Android | PWA only | ✅ | ✅ |
| Cash flow forecasting | ❌ | ✅ | ✅ |

---

## Roadmap

### Done ✅
- [x] 4 payoff strategies + freed-minimum rollover + lump-sum simulator + required-payment calculator
- [x] Goals system (3 goal types)
- [x] Transaction history with category filters, trends chart, recurring detection
- [x] AI insights with freemium gate
- [x] Card recommendation engine (10 cards, 8 categories, TPG valuations, debt penalty)
- [x] Budget system with per-category progress tracking
- [x] Firebase stack (Auth + Firestore + Cloud Functions + Hosting)
- [x] All Plaid account types (depository, credit, investment, loan, mortgage, brokerage)
- [x] Net worth tracking + monthly history snapshots
- [x] Drag-and-drop dashboard with Firestore-backed widget config
- [x] Dark/light theme toggle with no-flash init
- [x] Tailwind v4 + shadcn/ui complete migration
- [x] Mantine fully removed — Tailwind is sole CSS engine
- [x] Dashboard col-1 charts: 3-line net worth, 4-slice allocation donut
- [x] Accounts page: category-first layout (Cash/Investments/Credit/Loans)
- [x] Institution logos — runtime keyword match, logo.dev delivery, brand-color fallback
- [x] Credit card chip art on all credit rows and Dashboard priority card
- [x] Investment holdings sync (Plaid Investments product, `investment_holdings` subcollection)
- [x] Stocks & Bonds dual connect CTAs (Plaid + manual)

### Phase 2 — Feature Parity 📋
- [ ] Credit score monitoring (Experian or Spinwheel VantageScore)
- [ ] Manual account entry (no Plaid required — medical debt, personal loans)
- [ ] Cash flow forecasting (3–6 month projection)
- [ ] Budget AI recommendations (Claude analyzes 3-month history, suggests limits)

### Phase 3 — Differentiation 📋
- [ ] Couples/household mode
- [ ] Lump-sum split across multiple cards
- [ ] PDF/CSV export
- [ ] Subscription cancellation workflow
- [ ] Promo APR expiry date wired up from Plaid data

### Pre-Go-Live Gates 🔒
- [ ] Plaid production credentials (`PLAID_ENV=sandbox` → `production`)
- [ ] Stripe freemium gate (`is_pro` flag in Firestore, needs Stripe Checkout + webhook)
- [ ] Plaid webhooks for real-time transaction updates
