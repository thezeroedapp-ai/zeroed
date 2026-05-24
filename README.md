# Zeroed — Debt Payoff Tracker

> **Keep this README updated.** After every dev session, update Current Status, Changelog, and Roadmap. The README is the single source of truth for where the project stands — if it's not in here, it didn't happen. See `DEVLOG.md` for day-by-day session notes. See `DESIGN.md` for the UI design system — read it before touching any CSS or inline styles.

The goal of Zeroed is simple: **know exactly when you'll be debt-free, and take the fastest path there.**

Most people with credit card debt don't have a clear picture — they make minimum payments, get hit with interest, and never see the finish line. Zeroed connects to your real bank accounts, surfaces your actual APRs and balances, and runs a month-by-month simulation that shows you the optimal order to attack your debt, your exact debt-free date, and how much interest you'll save by throwing even an extra $100/mo at it.

Built as a mobile-first React PWA. Backend runs on Firebase Cloud Functions.

---

## Current Status

**v6.2 — Bug fixes, code quality, and glass/material design removal.** *(2026-05-24)*

Live at: **[https://zeroed-3331d.web.app](https://zeroed-3331d.web.app)**

Full Firebase stack live with dark/light toggle:

- **Auth:** Firebase Authentication (email/password + Google OAuth)
- **Database:** Firestore — subcollections under `users/{uid}/`
- **API:** Express wrapped as Firebase Cloud Functions (`exports.api`)
- **Hosting:** Firebase Hosting (React SPA) + Rewrites to Cloud Functions
- **Frontend:** React 18 + Vite + TypeScript — shadcn/ui component library, Tailwind CSS v4, lucide-react icons, 5-tab nav with subtabs, drag-and-drop dashboard, dark/light toggle

All screens working (5-tab structure):
- **Home (Dashboard)** — hero card (total debt + monthly interest cost + 3-stat strip), customizable 7-widget drag-and-drop grid: payoff projection area chart, spending by category horizontal bars (click → drill-down Sheet), net worth sparkline (click → assets/liabilities detail), priority attack card, goals progress, AI insights, alerts. Widget order + visibility saved to Firestore. Touch-friendly (dnd-kit).
- **Plan** — 3 subtabs: Strategy (4 strategy cards with emoji icons + visual selector, freed-minimum rollover, lump-sum simulator, extra payment calculator), Goals (debt-free date targets, per-card payoff goals, balance targets, required-payment calculator with Progress bars), AI Insights (Claude-powered spending analysis)
- **Accounts** — 3 subtabs: Accounts (all types grouped by institution, net worth strip, inline APR/min edit with shadcn Input/Label), Budget (per-category monthly budgets with Progress bars, shadcn Select), Rewards (category-based card recommendations ranked by reward multipliers and TPG valuations)
- **Spending** — 3 subtabs: Transactions (filterable by expenses/payments, "Explore cards →" teaser), Trends (6-month stacked bar chart via shadcn ChartContainer + recharts), Recurring (auto-detected subscriptions with annual cost hero card + category Badge)
- **Settings** — bank connect/disconnect, income profile (Save flash feedback), sinking funds manager

**Next (Phase 2):** Credit score monitoring, manual account entry, cash flow forecast, investment tracking display → budget AI recommendations, couples mode. Plaid production + Stripe are pre-go-live gates, not pre-test-user gates.

---

## Changelog

| Version | Date | What shipped |
|---------|------|--------------|
| v6.2 | 2026-05-24 | Bug fixes + code quality + glass removal: extracted shared `AvatarCircle` component (was copy-pasted in Accounts, Spending, Settings); fixed `Content-Type: application/json` sent on GET requests in `apiFetch`; fixed hardcoded white chart colors in Dashboard (invisible in light mode) → `var(--border)`; fixed `parseFloat('')` NaN guard on Accounts edit form; replaced all `alert()`/`confirm()` with inline two-click confirmation pattern (Plan, Accounts, Settings); renamed `insight` state → `insightPayload` to eliminate triple `.insight.insight.insight` access; fixed Spending URL-based tab state via `useSearchParams`; fixed "Using the right card?" banner showing on payments filter; removed glass morphism and material design: `.glass`/`card-hero`/`card-elevated` CSS classes, all `backdrop-filter: blur()`, body violet bloom gradient, entire shadow variable system (`--shadow-card`/`--shadow-elevated`/`--shadow-hero`/`--shadow-nav`); simplified `.side-nav`/`.bottom-nav`/`.top-bar` to solid backgrounds |
| v6.1 | 2026-05-24 | Layout spacing, sidebar contrast, and nav active state fixes |
| v6.0 | 2026-05-24 | UI redesign: Monarch-style spacing, typography, and visual polish |
| v5.4 | 2026-05-23 | UI patch: removed `bg-background` from all 4 inner pages (Plan, Accounts, Spending, Settings) so body gradient is visible; replaced `bg-background/85 backdrop-blur-xl` with `top-bar` CSS class for glass blur to work; dark mode card lightness `0.105→0.140`, surface-2 `0.135→0.180`, border opacity `10%→14%`, card shadow ring `7%→12%` — cards now clearly visible; light mode background shifted to warmer off-white; page titles `text-[17px]→text-xl`; Settings `space-y-6→space-y-8`; deployed to Firebase |
| v5.3 | 2026-05-23 | Glass UI design system + dark/light theme toggle: `ThemeContext` with `localStorage` persistence (`zeroed-theme` key), `html.dark` CSS class strategy, inline script in `index.html` prevents flash; full light theme (separate oklch palette — near-white surfaces, darker status colors for contrast); frosted glass SideNav, BottomNav, Dashboard top bar via `backdrop-filter: blur(20px)`; hero card violet glow (`card-hero` box-shadow with oklch ambient glow in dark mode); elevation shadow system (`--shadow-card`/`--shadow-elevated`/`--shadow-hero` CSS vars override Tailwind `shadow-sm`/`shadow-md`); violet radial gradient page background gives glass depth; Sun/Moon toggle at sidebar bottom; smooth `theme-transitioning` CSS class animates colors on toggle |
| v5.2 | 2026-05-23 | shadcn/ui + Tailwind v4 migration: replaced hand-rolled CSS with shadcn/ui component library (Card, Button, Badge, Input, Select, Progress, Sheet, ChartContainer, Tooltip — 15 components); Tailwind CSS v4 via `@tailwindcss/vite`, CSS-first `@theme inline` config with oklch color palette; lucide-react icons; all pages rewritten (Dashboard, Plan, Accounts, Spending, Settings, Login, Signup); drill-down `Sheet` panels on dashboard (spending category → full list, net worth → assets/liabilities, goals → details); fixed sidebar layout bug (flex + fixed = content overlap; switched to margin-left approach); improved hero card (two-column debt+interest layout, 3-stat strip); taller charts; collapsed sidebar shows icon-only at md breakpoint |
| v5.1 | 2026-05-23 | Drag-and-drop dashboard: replaced ↑/↓ reorder buttons with dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) — `PointerSensor` (8px) + `TouchSensor` (200ms/8px) for desktop+mobile, `DragOverlay` ghost card, debounced 600ms auto-save to Firestore; `SortableWidgetShell` with dedicated `⠿` drag handle + `×` remove; uniform `.widget-grid` (2-col tablet/desktop); comprehensive demo seed (`scripts/seed-demo.js`) — 10 accounts, 201 transactions, 6 months Dec 2025–May 2026, 6 net worth snapshots, 3 goals, 7 budgets, 3 sinking funds |
| v5.0 | 2026-05-23 | Phase 1 complete: design system lock-in (`--font-mono`, `.widget-card`, compat alias sweep); net worth monthly snapshots on every sync stored to `net_worth_history/{YYYY-MM}`; Dashboard manager — 9 configurable widgets with Firestore-backed layout (`dashboard_config/default`), edit mode with toggle + reorder |
| v4.5 | 2026-05-23 | Plaid production readiness: update mode (reconnect broken connections), item-level disconnect with Plaid token revocation, cursor-based `transactionsSync` replacing legacy `transactionsGet`, `error_status` on plaid items, Settings UI with Connect/Reconnect/Disconnect/Sync Now |
| v4.4 | 2026-05-23 | Firebase Cloud Functions upgraded: Node 20 1st Gen → Node 22 2nd Gen; firebase-functions v4 → v5; index.js migrated from v1 API (functions.https/pubsub) to v2 API (onRequest/onSchedule) |
| v4.3 | 2026-05-23 | Tech debt cleanup (expenses→sinking_funds, recommendations→rewards, removed old HTML public/ dir); 5-tab nav consolidation (Goals→Plan subtab, Budget+Rewards→Accounts subtabs); "Explore cards →" teaser in Spending→Transactions; legacy route redirects |
| v4.2 | 2026-05-22 | Monarch/Origin parity — all Plaid account types (investment, loan, mortgage, brokerage); net worth on Dashboard + Accounts; Budget screen with per-category progress; Spending screen (transactions + stacked trends chart + recurring detection); first production Firebase deploy to zeroed-3331d.web.app |
| v4.1 | 2026-05-22 | Dark premium UI redesign — complete `index.css` overhaul (violet accent, navy backgrounds, glassmorphism nav); Dashboard bento grid with recharts debt payoff projection; bug fixes: Recommend auth token, Goals Firestore string IDs, plan route response shape |
| v4.0 | 2026-05-22 | Firebase migration — replaced Railway + Supabase + PostgreSQL with Firebase Auth + Firestore + Cloud Functions + Hosting; React frontend migrated from Supabase SDK to Firebase SDK; all routes scoped to `req.user.uid` (string); Firestore subcollections under `users/{uid}/`; `firebase deploy` ships everything |
| v3.2 | 2026-05-21 | Monorepo restructure — `server/`, `apps/web/`, `packages/core/`; responsive layout (mobile bottom nav, tablet/desktop sidebar) |
| v3.1 | 2026-05-21 | React + Vite + TypeScript frontend — replaced vanilla HTML; React Router, AuthContext, all 9 pages |
| v3.0 | 2026-05-21 | Multi-user auth — Supabase Auth (email/password + Google OAuth); JWT middleware; all 7 pages gated |
| v2.1 | 2026-05-20 | Supabase live + NUMERIC type parser fix |
| v2.0 | 2026-05-20 | PostgreSQL/Supabase migration — replaced SQLite with pg; async/await throughout |
| v1.4 | 2026-05-20 | Card recommendation engine — curated reward profiles, TPG valuations, 8-category picker |
| v1.3 | 2026-05-20 | AI spending insights (Dashboard), manual APR inline edit |
| v1.2 | 2026-05-20 | Sinking funds manager, surplus accuracy fix |
| v1.1 | 2026-05-20 | 4-strategy grid, lump-sum simulator, Goals screen |
| v1.0 | 2026-05-20 | Initial build: Dashboard, Plan, Accounts, Activity, Settings; Plaid sandbox; SQLite |

---

## What It Does

### Core Features

- **Home (Dashboard)** — Total debt, monthly interest cost, surplus, debt-free date, net worth (assets − liabilities), smart alerts, live goals status card, projected payoff chart
- **Plan › Strategy** — Four payoff strategies, 3 scenarios, extra payment slider, lump-sum simulator, attack order with per-card payoff dates
- **Plan › Goals** — Set debt-free date targets, per-card payoff goals, balance targets; required-payment calculator answers "what does it take to be free by [date]?"
- **Plan › AI Insights** — Claude-powered spending analysis, 10 free/month with freemium gate
- **Accounts › Accounts** — All connected accounts grouped by institution and type (Cash & Savings, Investments, Credit Cards, Loans); net worth summary strip; inline edit for APR/min payment on credit cards
- **Accounts › Budget** — Set per-category monthly spending limits; progress bars (spent/remaining/pct), overall summary strip; add/remove budgets
- **Accounts › Rewards** — Pick a spend category and get ranked card recommendations; active-debt cards ranked lower automatically
- **Spending › Transactions** — Filterable by expenses/payments, account name lookup; "Explore cards →" teaser linking to Accounts › Rewards
- **Spending › Trends** — 6-month stacked bar chart by category (recharts)
- **Spending › Recurring** — Auto-detected subscriptions from 2+ months of history, annual cost estimate
- **Settings** — Connect/disconnect banks via Plaid Link, update income/strategy, manage sinking funds

### Payoff Strategies

| Strategy | How it works | Best for |
|---|---|---|
| **Avalanche** | Highest APR first | Minimizing total interest (mathematically optimal) |
| **Snowball** | Lowest balance first | Motivation — quick wins build momentum |
| **Hybrid** | 60% APR + 40% balance weighting | Balanced — good math *and* visible progress |
| **Cash Flow** | Highest min-payment/balance ratio first | Freeing up monthly cash flow fastest |

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
git clone https://github.com/adornedbyveena/zeroed.git
cd zeroed
npm install
```

### 2. Configure environment

Create a `.env` file at the project root (see `.env.example` for all keys):

```
# Firebase (server-side) — Firebase console → Project settings → Service accounts → Generate new private key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}  # paste JSON as a single line

# Plaid — dashboard.plaid.com → Team Settings → Keys
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox

# AI insights (optional)
ANTHROPIC_API_KEY=sk-ant-...

PORT=3000
```

`apps/web/.env.local` (Firebase client config) is **committed to git** — no manual creation needed. The values are public by design (Firebase client config is not secret).

### 3. Start local development

```bash
# Terminal 1 — Express backend on :3000
npm run dev

# Terminal 2 — Vite frontend on :5173 (proxies /api to :3000)
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173).

**UI-only development (no local server needed)** — proxies API calls to production Firebase:

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
│   ├── index.js              # Cloud Functions entry — exports.api + exports.dailySync
│   ├── server.js             # Express app — all routes, dashboard, user endpoints
│   ├── db/
│   │   └── database.js       # Firebase Admin SDK — Firestore CRUD, all data access
│   ├── middleware/
│   │   └── auth.js           # Firebase token verification — verifyIdToken, auto-create profile
│   ├── routes/
│   │   ├── plaid.js          # /api/plaid/* — link token, exchange, sync, accounts, items
│   │   ├── plan.js           # /api/plan/* — generate, latest, lump-sum, required-payment, alerts
│   │   ├── goals.js          # /api/goals — CRUD + live progress computation
│   │   ├── sinking-funds.js  # /api/sinking-funds — income + sinking funds CRUD
│   │   ├── transactions.js   # /api/transactions — history, category summary, trends, recurring
│   │   ├── budgets.js        # /api/budgets — CRUD + current-month spending enrichment
│   │   ├── insights.js       # /api/insights — AI spending analysis, freemium gate
│   │   ├── rewards.js        # /api/rewards — ranked card suggestions
│   │   └── admin.js          # /api/admin — admin-only user management
│   ├── services/
│   │   ├── plaidService.js         # Plaid API — sync accounts + transactions (all account types)
│   │   ├── payoffEngine.js         # Pure math — 4 strategies, simulate, lump-sum, required-payment
│   │   ├── claudeService.js        # Claude API — plan insight + spending analysis
│   │   ├── cardProfiles.js         # Curated reward profiles — multipliers, TPG valuations
│   │   └── recommendationEngine.js # Ranking logic — effectiveRate, debt penalty
│   └── package.json
├── apps/web/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── firebase.ts    # Firebase client init (Auth)
│   │   │   └── api.ts         # apiFetch — attaches Firebase ID token to all requests
│   │   ├── context/
│   │   │   ├── AuthContext.tsx  # Firebase onAuthStateChanged, profile fetch, signOut
│   │   │   └── ThemeContext.tsx # Dark/light toggle — localStorage, html.dark class, no-flash init
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── SideNav.tsx    # 5-tab sidebar (Home, Plan, Accounts, Spending, Settings)
│   │   │   ├── BottomNav.tsx  # 5-tab mobile nav (same tabs)
│   │   │   └── SubNav.tsx     # Reusable horizontal subtab bar
│   │   └── pages/
│   │       ├── Dashboard.tsx  # Home tab
│   │       ├── Plan.tsx       # Plan tab (Strategy / Goals / AI Insights subtabs)
│   │       ├── Accounts.tsx   # Accounts tab (Accounts / Budget / Rewards subtabs)
│   │       ├── Spending.tsx   # Spending tab (Transactions / Trends / Recurring subtabs)
│   │       ├── Settings.tsx, Admin.tsx, Login.tsx, Signup.tsx
│   ├── .env.local             # VITE_FIREBASE_* vars (committed — Firebase client config is public)
│   └── package.json
├── packages/core/
│   └── index.ts               # Shared: fmt(), fmtD(), ROUTES constants
├── firebase.json              # Hosting + Functions + Firestore config
├── .firebaserc                # Project: zeroed-3331d
├── firestore.rules            # Deny-all (Admin SDK bypasses)
├── firestore.indexes.json     # Composite indexes
├── .env.example               # Documents required server env vars
├── DEVLOG.md
└── package.json               # npm workspaces root
```

---

## API Reference

All `/api/*` routes require `Authorization: Bearer <Firebase ID token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/user` | User profile |
| PUT | `/api/user` | Update income, expenses, or strategy |
| GET | `/api/dashboard` | Aggregated totals, alerts, priority card, debt-free date |
| GET | `/api/plaid/accounts` | All connected accounts |
| POST | `/api/plaid/create-link-token` | Start Plaid Link flow |
| POST | `/api/plaid/create-link-token/update` | Update mode link token (reconnect broken connection) |
| POST | `/api/plaid/exchange-token` | Complete Plaid Link, store access token |
| POST | `/api/plaid/sync` | Refresh balances + pull new transactions (cursor-based) |
| GET | `/api/plaid/items` | Connected bank institutions (includes `error_status`) |
| DELETE | `/api/plaid/items/:itemId` | Disconnect entire bank — revokes Plaid token, deletes all accounts + transactions |
| PUT | `/api/plaid/accounts/:id/credit-details` | Set APR, min payment, due date |
| DELETE | `/api/plaid/accounts/:id` | Remove single account |
| POST | `/api/plan/generate` | Run payoff engine + Claude insight, persist plan |
| GET | `/api/plan/latest` | Last saved plan |
| GET | `/api/plan/alerts` | Promo APR expiry + high utilization alerts |
| POST | `/api/plan/lump-sum` | Simulate one-time extra payment impact |
| POST | `/api/plan/required-payment` | Extra monthly needed for a target date |
| GET | `/api/goals` | All active goals with live progress |
| POST | `/api/goals` | Create a goal |
| DELETE | `/api/goals/:id` | Remove a goal |
| GET | `/api/transactions` | Transaction list |
| GET | `/api/transactions/summary` | Spending by category |
| GET | `/api/transactions/trends` | 6-month spending by category (top 7, stacked chart data) |
| GET | `/api/transactions/recurring` | Recurring transactions detected from 2+ months of history |
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
| `accounts` | `plaid_account_id` | name, type (`depository`/`credit`/`investment`/`loan`/`mortgage`/`brokerage`), subtype, balance_current, apr, minimum_payment, credit_limit, institution_name |
| `transactions` | `plaid_transaction_id` | account_id, amount, date, name, category |
| `goals` | auto | goal_type, target_date, target_balance, account_id, is_active |
| `sinking_funds` | auto | category, monthly_amount, label |
| `budgets` | auto | category, monthly_limit, created_at, updated_at |
| `insights` | auto | content, created_at |
| `ai_usage` | `YYYY-MM` | count |
| `plaid_items` | `plaid_item_id` | access_token, institution_name, transactions_cursor, error_status, updated_at |
| `payoff_plans` | auto | strategy, surplus, items (embedded array) |
| `dashboard_config` | `default` | widgets (ordered string array, max 9) |
| `net_worth_history` | `YYYY-MM` | total_assets, total_liabilities, net_worth, recorded_at |

---

## Payoff Engine

The engine (`server/services/payoffEngine.js`) runs entirely locally — no API calls.

**Core simulation:** Each month — accrue interest → pay all minimums → attack priority card with surplus. When a card pays off, its minimum **permanently joins** the attack budget (freed-minimum rollover).

**Lump-sum simulation:** Reduces a card's balance by the lump amount, then runs a normal simulation. Returns `monthsSaved` and `interestSaved` vs. baseline.

**Required-payment calculator:** Binary search (50 iterations) over the extra payment range `[0, totalDebt]` to find the minimum extra amount that achieves `months ≤ targetMonths`.

---

## Connecting Real Banks (Plaid Sandbox)

In sandbox mode, use these fake credentials inside the Plaid Link widget:

- **Username:** `user_good`
- **Password:** `pass_good`

---

## Competitive Landscape

Zeroed competes directly with **Monarch Money** and **Origin** — the two leading all-in-one personal finance apps. Both are priced at ~$99/year. Both are pure subscription with no free tier.

### Where Zeroed Wins

| Feature | Zeroed | Monarch | Origin |
|---|---|---|---|
| **Debt payoff strategies** | 4 (Avalanche, Snowball, Hybrid, Cash Flow) | Basic | Basic |
| **Freed-minimum rollover** | ✅ Automatic | ❌ | ❌ |
| **Lump-sum simulator** | ✅ (months + interest saved) | ❌ | ❌ |
| **Required-payment calculator** | ✅ (binary search to target date) | ❌ | ❌ |
| **Card reward recommendations** | ✅ (10 cards, TPG valuations, debt penalty) | ❌ | ❌ |
| **Freemium tier** | ✅ (10 AI insights/mo free) | ❌ | ❌ |

Zeroed's debt payoff engine is the deepest in the consumer market. Neither competitor models freed-minimum rollover, runs lump-sum simulations, or calculates the exact extra monthly payment needed to hit a target date. This is the moat.

### Where Zeroed Is Behind

| Feature | Zeroed | Monarch | Origin |
|---|---|---|---|
| **Credit score monitoring** | ❌ | ✅ VantageScore via Spinwheel | ❌ |
| **Net worth history** | Snapshot only | ✅ Month-over-month chart | ✅ + 30-yr projection |
| **Investment tracking** | Accounts pulled, nothing shown | ✅ Real-time portfolio | ✅ + direct investing |
| **Budget AI recommendations** | Manual entry only | ✅ AI-suggested | ✅ AI-suggested |
| **Cash flow forecasting** | ❌ | ✅ (Plus tier) | ✅ |
| **Couples/household mode** | ❌ | ✅ | ✅ |
| **Native iOS/Android** | PWA only | ✅ | ✅ |
| **AI depth** | 10/mo gated | Unlimited (Sparkle + Weekly Recap) | SEC-regulated CFP-level advisor |

### What We're Not Chasing

- **Retirement modeling / tax filing / estate planning** — Origin's premium positioning. Not Zeroed's identity.
- **Direct investing / cash management accounts** — Licensed financial products, not a feature.
- **Rewards points balances** — Plaid doesn't have this data. Yodlee does but costs $1–2K/month minimum and is fully sales-led. Not viable pre-revenue.

### Business Model Comparison

| | Monarch | Origin | Zeroed (target) |
|---|---|---|---|
| **Price** | $99/yr or $15/mo | $99/yr or $13/mo | TBD |
| **Free tier** | 7-day trial only | 7-day trial only | 10 AI insights/mo free |
| **Model** | Pure subscription | Pure subscription | Freemium → Pro |
| **Native app** | iOS + Android | iOS + Android | PWA (React Native later) |

Zeroed's freemium model is a user acquisition advantage — lower friction to sign up than either competitor. The Pro gate needs to be meaningful enough to convert: unlimited AI insights, advanced forecasting, couples mode.

---

## UI Design System

> **See [`DESIGN.md`](DESIGN.md) for legacy token reference. The canonical component system is now shadcn/ui + Tailwind v4 — read `apps/web/src/index.css` for the current token set.**

### Philosophy

Consumer fintech lives on trust and first impressions. A test user decides in 10 seconds whether this feels like a real product or a side project. The goal is a UI that feels *premium and purposeful* — not generic SaaS. Every screen should communicate that this app understands debt better than any other.

**Design language:**
- **Dark-first with light/dark toggle** — default is dark (`oklch(0.065 0.015 264)` background); users toggle via Sun/Moon button at the bottom of the sidebar. Preference persisted in `localStorage` under `zeroed-theme`. Applied before first paint via inline `<script>` in `index.html` (no flash).
- **Violet accent** — `oklch(0.49 0.21 290)` (`#7c3aed`) primary, `oklch(0.72 0.14 290)` (`#a78bfa`) light in dark mode / `oklch(0.42 0.22 290)` deep violet in light mode. Intentional differentiation from blue (every other finance app).
- **Theme switching** — `:root` defines light theme; `html.dark` overrides to dark. `ThemeContext` (`src/context/ThemeContext.tsx`) manages the class. `theme-transitioning` CSS class applied during toggle for smooth 220ms color transitions.
- **Solid surfaces** — nav bars and cards use flat solid backgrounds (`var(--nav-bg)`, `var(--card)`). No glass morphism (`backdrop-filter`) or material elevation shadows — clean and performant.
- **shadcn/ui** — copy-paste component model; `@/components/ui/` for Card, Button, Badge, Input, Select, Progress, Sheet, Tooltip, ChartContainer. `cn()` utility (`clsx` + `tailwind-merge`) for conditional classes.
- **Tabular numerals** — all currency and percentage values use `tabular` utility class (`font-variant-numeric: tabular-nums`).
- **recharts via ChartContainer** — all data visualizations; `ChartConfig` for label/color mapping; `ChartTooltipContent` for consistent tooltips.
- **Drill-down via Sheet** — clicking a chart element opens a shadcn `Sheet` slide-out panel with full detail view; implemented on spending category bars, net worth trend, and goals rows.

### Dashboard Manager

The Home screen is fully customizable. Users can build their own dashboard from a library of 9 widgets, arranged in a drag-and-drop bento grid.

**Available widgets:**

| Widget | Data source | Chart type |
|---|---|---|
| **Debt Payoff Projection** | Payoff engine | Area chart — remaining balance over months |
| **Net Worth Trend** | Monthly Firestore snapshots | Line chart — assets vs liabilities over 12 months |
| **Cash Flow Forecast** | Income + recurring + debt payments | Bar chart — projected monthly surplus 6 months out |
| **Spending by Category** | Transactions last 30 days | Donut chart — top 6 categories |
| **Credit Score** | Credit monitoring API | Single stat + trend line |
| **Goals Progress** | Goals subcollection | Progress bars — active goals with % complete |
| **Upcoming Bills** | Recurring + payment due dates | List — next 7 days |
| **Interest Cost Over Time** | Payoff engine | Area chart — cumulative interest paid vs saved |
| **Savings Rate** | Income vs spending | Gauge — % of income not spent or debt-serviced |

**Implementation:**
- Widget config stored in Firestore at `users/{uid}/dashboard_config` as `{ widgets: ['debt_projection', 'net_worth', ...] }` — ordered array, max 9
- Default config for new users: `['debt_projection', 'net_worth', 'spending_by_category', 'goals_progress']`
- Each widget is a self-contained React component that fetches its own data on mount
- Bento grid layout: mobile = single column; tablet = 2-col; desktop = dynamic based on widget count
- Edit mode: tap "Edit Dashboard" to enter drag-and-drop reorder mode and show add/remove widget picker

### Design System — Tokens to Lock In

All values to be defined as CSS custom properties in `index.css` and used consistently across every screen:

```
/* Surfaces */
--bg:          #07090f    /* page background */
--surface:     #0d1424    /* cards */
--surface-2:   #111827    /* nested surfaces, inputs */
--border:      rgba(255,255,255,0.08)

/* Accent */
--accent:      #7c3aed
--accent-light: #a78bfa
--accent-dim:  rgba(124,58,237,0.15)

/* Text */
--text:        #f1f5f9    /* primary */
--text-sm:     #94a3b8    /* secondary */
--text-xs:     #64748b    /* tertiary */

/* Status */
--green:       #22c55e
--red:         #ef4444
--amber:       #f59e0b

/* Spacing */
--pad:         16px       /* standard card padding */
--radius:      12px       /* card border radius */
--radius-sm:   8px        /* inner elements */

/* Typography */
--font-mono:   'SF Mono', 'Fira Code', monospace  /* numbers */
```

**Card anatomy (standard across all screens):**
```
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--pad);
}
```

**Button hierarchy:**
- `.btn-primary` — violet fill, used for primary actions only (1 per screen max)
- `.btn` — surface-colored outline, secondary actions
- `.btn-danger` — red tint, destructive actions only

### Screen-by-Screen UI Plan

**Dashboard (Phase 1 priority)**
- Replace static bento grid with dynamic widget grid driven by `dashboard_config`
- Add "Edit Dashboard" button (top-right) that enters drag-and-drop mode
- Widget picker modal: 3-column grid of available widgets with toggle on/off
- Each widget card has a consistent header (title + icon + optional "view full" link to the relevant tab)
- Empty state per widget (skeleton loaders while data fetches, not blank cards)

**Plan**
- Strategy tab: make the 4-strategy selector more visual — card-style with icon, name, one-line description, and "best for" tag; highlight the active strategy with violet border
- Payoff timeline: upgrade from plain card list to a visual timeline with milestones
- Lump-sum simulator: add a before/after comparison bar to visualize months saved

**Accounts**
- Account cards: add institution logo (use Plaid's institution logo URL or favicon fallback)
- Net worth strip: upgrade to a mini sparkline showing 3-month trend instead of just today's number
- APR warning badges: more prominent — amber dot with tooltip explaining why it matters

**Spending**
- Transactions: merchant logo / icon (Plaid provides `logo_url` on some transactions)
- Trends chart: add a "you spent X% more/less than last month" callout above the chart
- Recurring: add estimated annual total more prominently; sort by highest annual cost

**Settings**
- Connected banks: show institution logo next to bank name
- Add a "Last sync" relative timestamp ("2 minutes ago", "Yesterday") instead of raw date

### Figma / Design Reference

No Figma yet — design is being built directly in code. When a component is finalized, screenshot it and add to a `/design` directory as the reference for future consistency checks.

---

## Roadmap

### Done ✅
- [x] 4 payoff strategies: Avalanche, Snowball, Hybrid, Cash Flow
- [x] Freed-minimum rollover, lump-sum simulator, required-payment calculator
- [x] Goals system with 3 goal types
- [x] Transaction history with category filters
- [x] AI insights (Plan + Dashboard) with freemium gate (`is_pro`)
- [x] Card recommendation engine — 10 cards, 8 categories, TPG valuations
- [x] Sinking funds — flows into all surplus calculations
- [x] Manual APR/min payment inline edit
- [x] **React + Vite + TypeScript** frontend
- [x] **Monorepo** — `server/`, `apps/web/`, `packages/core/`
- [x] **Multi-user auth** — email/password + Google OAuth
- [x] **Firebase migration** — Auth + Firestore + Cloud Functions + Hosting; Railway + Supabase + PostgreSQL removed *(v4.0, 2026-05-22)*
- [x] **All Plaid account types** — depository, credit, investment, loan, mortgage, brokerage *(v4.2)*
- [x] **Net worth tracking** — Total Assets − Total Liabilities on Dashboard + Accounts *(v4.2)*
- [x] **Budget system** — per-category monthly limits, progress bars, spent/remaining *(v4.2)*
- [x] **Spending trends** — 6-month stacked bar chart by category (recharts) *(v4.2)*
- [x] **Recurring detection** — auto-detect subscriptions from 2+ months of history, annual cost *(v4.2)*
- [x] **Firebase production deploy** — live at zeroed-3331d.web.app *(v4.2, 2026-05-22)*
- [x] **Mac + Windows simultaneous dev** — `.env.local` committed, `dev:web:remote` script proxies to production *(v4.2)*
- [x] **Tech debt cleanup** — renamed `expenses`→`sinking_funds` (Firestore + routes), `recommendations`→`rewards`; removed old vanilla HTML public/ dir; consistent `monthly_amount` field throughout *(v4.3, 2026-05-23)*
- [x] **5-tab nav consolidation** — Goals→Plan subtab, Budget+Rewards→Accounts subtabs; reusable `SubNav` component; URL-based subtab navigation via `useSearchParams`; "Explore cards →" cross-tab deep link *(v4.3, 2026-05-23)*
- [x] **Cloud Functions 2nd Gen** — Node 20 → 22, firebase-functions v4 → v5, v1 API → v2 `onRequest`/`onSchedule` *(v4.4, 2026-05-23)*
- [x] **Plaid production readiness** — update mode link token, `itemRemove` token revocation, cursor-based `transactionsSync` (incremental + handles removed transactions), `error_status` per item, Settings UI with Connect/Reconnect/Disconnect/Sync Now *(v4.5, 2026-05-23)*

### Phase 1 — Dashboard UI + Design System ✅
The Dashboard is the first screen every user sees. Nail this before adding features so the design language is locked before new screens are built.

- [x] **Dashboard manager** — 9 configurable widgets with drag-and-drop reorder (dnd-kit), add/remove, Firestore-backed layout, touch-friendly *(v5.0–5.1, 2026-05-23)*
- [x] **Net worth history chart** — month-over-month line chart; monthly snapshots written to `net_worth_history/{YYYY-MM}` on every Plaid sync *(v5.0, 2026-05-23)*
- [x] **shadcn/ui + Tailwind v4 migration** — complete rewrite of all pages and components; 15 shadcn components, oklch color system, lucide-react icons, drill-down Sheet panels, fixed sidebar layout, improved hero card *(v5.2, 2026-05-23)*
- [x] **`index.html` title** — changed from "Vite + React + TS" to "Zeroed"
- [x] **Glass UI + dark/light theme toggle** — `ThemeContext`, `html.dark` CSS class strategy, `localStorage` persistence, no-flash init script; full light oklch palette *(v5.3, 2026-05-23)*
- [x] **UI patch — card contrast + typography** — dark mode card contrast and border visibility; page title size and padding *(v5.4, 2026-05-23)*
- [x] **Monarch-style UI redesign** — spacing system, typography hierarchy, nav polish, sidebar contrast, active state *(v6.0–6.1, 2026-05-24)*
- [x] **Bug fixes + glass removal** — shared `AvatarCircle` component; inline `confirm`/`alert` replacements; NaN guard on edit form; fixed chart colors in light mode; removed all glass morphism, backdrop-filter, body gradient, shadow variable system *(v6.2, 2026-05-24)*
- [ ] **Promo APR expiry date** — wire up the field Plaid already returns (currently hardcoded `null`); expose in Accounts inline edit

### UI Redesign Backlog (v6.0) 🎨

> **Pick up here on next session.** The current UI has the right structural foundations (shadcn/ui, oklch tokens, dark/light toggle, glass nav) but the visual quality does not match the reference apps (Monarch Money, Origin). This is a full visual redesign — not a feature build. Reference screenshots are in the DEVLOG entry for 2026-05-23 (v5.4 session).
>
> **Estimated scope:** ~4–6 hours of focused work across all 5 pages + CSS.

#### 1. Design Tokens & Global CSS (`apps/web/src/index.css`)

- [ ] **Switch default theme to light** — light mode should be primary; dark is the toggle option. Update `ThemeContext` default and `index.html` inline script. Light mode looks like Monarch/Origin; dark mode stays as the premium alternative.
- [ ] **Typography scale** — define and use consistently: page titles `28–32px bold`, section headers `16px semibold`, card titles `14px semibold uppercase tracking-wide`, body `15px`, caption `13px`, micro labels `11–12px`. Currently all headers are `text-[17px]` — no real hierarchy.
- [ ] **Spacing system** — standardize: page horizontal padding `px-6 lg:px-12`, section vertical gap `space-y-8`, card internal padding `p-6` (24px) everywhere. Currently cards mix `p-3`, `p-4`, `p-5`.
- [ ] **Light mode background** — use `oklch(0.97 0.003 250)` (near-white, barely warm) for page background; `oklch(1 0 0)` white for cards. Currently slightly tinted, should be cleaner.
- [ ] **Dark mode card contrast** — increase card to `oklch(0.155 0.024 258)` (was 0.140) for an even more visible separation from `oklch(0.060)` background.
- [ ] **Border system** — light mode: `oklch(0 0 0 / 10%)` for card edges (clean definition like Monarch). Dark mode: `oklch(1 0 0 / 16%)`.
- [ ] **Section label style** — replace `text-[11px] font-bold uppercase tracking-widest text-muted-foreground` with a more readable `text-xs font-semibold text-muted-foreground` — current all-caps micro labels are hard to read.
- [ ] **Remove all page-level gradient** — body radial gradient is a design choice for dark mode only. In light mode it competes with the clean white card aesthetic; suppress it via `html:not(.dark) body { background-image: none; }`.

#### 2. Sidebar (`apps/web/src/components/SideNav.tsx`)

- [ ] **Active state redesign** — replace colored text (`text-violet-light bg-violet-dim`) with a full-width highlight pill (white pill on dark / light gray pill on light), like Monarch. Active item should feel selected, not just colored.
- [ ] **Logo area** — increase logo size to `text-3xl`, add more bottom margin. Add a subtle divider line between logo and nav items.
- [ ] **Nav item sizing** — increase `py-2.5` to `py-3` for each item; `text-[13px]` → `text-sm (14px)`.
- [ ] **User profile at bottom** — above the theme toggle, show the logged-in user's email/name in a small `text-xs` row (like Monarch's "Melanie Smith" footer). Pull from `useAuth().user.email`.
- [ ] **Collapsed sidebar (md breakpoint)** — keep icon-only mode but center icons with 52px width (currently 40px squares feel too small).
- [ ] **Right border** — increase border visibility: `border-r border-border` → explicit `border-r-2 border-border` or use the `border-strong` var.

#### 3. Dashboard / Home (`apps/web/src/pages/Dashboard.tsx`)

- [ ] **Hero card redesign** — the hero card is the #1 most important element. Currently: small "TOTAL DEBT" label, large number, stats strip. Needs: remove the `Card` wrapper entirely — the hero should be a bare section directly on the page background with a subtle gradient fade. Large `$XX,XXX` number at `56–64px`, debt-free date very prominent (`text-2xl bold`), 3-stat strip with icons.
- [ ] **Page greeting** — "Good evening, Venkat" should be `text-2xl font-bold` not `text-[17px]`. Date should be `text-sm text-muted-foreground`. More vertical space between greeting and hero.
- [ ] **Widget card header** — all widget `CardHeader` sections should be: `CardTitle` at `text-sm font-semibold text-foreground` (not uppercase micro text), with a lucide icon left of the title, and a "View →" link right-aligned where applicable. Consistent height: `pt-5 px-5 pb-3`.
- [ ] **Widget grid gap** — increase from `18px` to `24px`.
- [ ] **Empty widget states** — when a widget has no data (e.g., AI Insights before first generation), show a proper empty state: centered icon + 1-line description + CTA button. No blank white cards.
- [ ] **Payoff projection chart** — add a subtle area fill gradient and a "Debt-free [date]" annotation at the end of the line.
- [ ] **Priority attack widget** — add a thin progress bar showing `balance / credit_limit` utilization below the card name. Make the "Extra dollars here save the most interest" copy bold violet, not plain muted.

#### 4. Plan page (`apps/web/src/pages/Plan.tsx`)

- [ ] **Page header** — `text-xl` is still too small; bump to `text-2xl font-bold`. Add a "Your debt payoff roadmap" subtitle at `text-sm text-muted-foreground`.
- [ ] **Strategy card redesign** — 2×2 grid cards are OK structurally but need: larger emoji (`text-2xl`), strategy name at `text-base font-bold`, description at `text-sm text-muted-foreground`, selected state with full card background tint + checkmark icon (top-right) + violet border. Unselected cards should look clearly "inactive."
- [ ] **Debt-free date card** — make the date `text-4xl font-extrabold`, move the summary stats (months, total interest, surplus) into a small row below. This is the most important output of the plan engine — it deserves more visual weight.
- [ ] **Attack order list** — add a thin progress bar per card showing balance paid vs. original (once we have historical data). Add card type icon (e.g., Visa/MC/Amex initial) in the numbered circle.
- [ ] **Pay more scenarios** — currently 3 plain `Card` items in a grid. Redesign as a comparison table: Base / +$300 / +$500 columns, highlighting the months and interest saved more dramatically.
- [ ] **Section separators** — add subtle `<Separator />` between strategy selector, debt-free date, scenarios, attack order, and calculators. Currently they all run together with only `space-y-4` gap.

#### 5. Accounts page (`apps/web/src/pages/Accounts.tsx`)

- [ ] **Institution header** — give each institution `Card` a slightly heavier header: institution name at `text-base font-bold`, account count badge right-aligned, and a subtle `bg-surface-2` tint on the `CardHeader`. Currently institution names float above the card.
- [ ] **Account rows** — increase row padding from `py-3` to `py-4`. Add a 2-letter avatar circle (institution initial) left of account name. Balance at `text-lg font-bold` (currently `text-base`).
- [ ] **Net worth strip** — the 3 cards (Assets/Liabilities/Net Worth) need more visual weight. Use `text-xl font-extrabold` for values (currently `text-base`). Add a subtle colored left border: green for Assets, red for Liabilities.
- [ ] **APR badges on credit cards** — the small `Badge` row is easy to miss. Make APR the most prominent credit card detail: `text-sm font-semibold text-amber` if high (>20%), `text-sm text-muted-foreground` if normal. Due date in red if within 7 days.
- [ ] **Budget tab** — budget progress bars are functional but need more breathing room. Increase card padding to `p-5`, add the budget category icon left of the category name, make over-budget state more dramatic (full red card tint not just red text).

#### 6. Spending page (`apps/web/src/pages/Spending.tsx`)

- [ ] **Transaction row height** — increase from `py-3` to `py-4`. The dense list is the first thing users see and it feels cramped.
- [ ] **Transaction icon** — replace `🛍️` / `✅` emojis with proper rounded avatars: a colored circle with the first letter of the merchant name (e.g., "S" for Starbucks in green). This is the single biggest visual improvement to the transactions list.
- [ ] **Month group header** — make month label `text-sm font-bold text-foreground` + show the month's total spend right-aligned (`text-sm tabular text-muted-foreground`). Currently just small caps with no total.
- [ ] **"Using the right card?" banner** — increase height, add a credit card icon left of the text, make the gradient more visible. Currently it reads like an afterthought.
- [ ] **Trends chart** — add a "You spent X% more/less than last month" callout above the chart. Currently the chart has no narrative context.
- [ ] **Recurring tab** — sort by `annualEstimate` descending (highest cost first). Add a "Cancel" link placeholder per item (non-functional for now but signals the feature direction). Annual estimate should be `text-2xl font-extrabold text-red` in the hero card.

#### 7. Settings page (`apps/web/src/pages/Settings.tsx`)

- [ ] **Section header redesign** — move section labels *inside* the Card as a `CardHeader` with `CardTitle` (`text-base font-semibold`) and a `CardDescription`. Currently they're small uppercase labels floating above cards — they don't look like section titles.
- [ ] **Sinking funds list** — each fund row needs `py-4` padding and the category icon (car 🚗, home 🏠, travel ✈️, etc.) left of the name. Currently just text rows.
- [ ] **Connected banks list** — show each bank as a Card with the institution initial avatar (colored circle, first letter), institution name `text-base font-semibold`, last synced relative time ("2 min ago", "Yesterday", not raw date).
- [ ] **Form fields** — input labels should be `text-sm font-medium text-foreground` (not `text-xs text-muted-foreground` — too dim). Helper text below inputs at `text-xs text-muted-foreground`.
- [ ] **Sign out** — move to bottom of page with a red-bordered card. Currently sits between Connected Banks and nothing.
- [ ] **Version number** — update "Zeroed v4.4" to current version dynamically or at least update the string.

#### 8. Bottom Nav (`apps/web/src/components/BottomNav.tsx`)

- [ ] **Active tab indicator** — add a small `2px` top border (violet) on the active tab, not just colored icon/text.
- [ ] **Height** — increase from `--nav-h: 60px` to `64px` for better thumb tap targets on mobile.
- [ ] **Labels** — show labels under icons on mobile (currently some mobile views hide them). Ensure all 5 labels are visible at all times.

---

### Phase 2 — Feature Parity with Monarch/Origin 📋
Build these features using the locked design system.

- [ ] **Credit score monitoring** — integrate Experian or Spinwheel (VantageScore); monthly update card on Dashboard; show how debt payoff trajectory affects score over time
- [ ] **Manual account entry** — add debt/account without Plaid (medical debt, personal loans, family debt); critical for users whose institution isn't Plaid-supported
- [ ] **Cash flow forecasting (3–6 months)** — project available monthly cash based on income, recurring expenses, and debt payoff schedule
- [ ] **Investment tracking** — use accounts already pulled via Plaid; show gains/losses, asset allocation, performance over time (currently pulled but not displayed)
- [ ] **Budget AI recommendations** — analyze 3 months of transaction history, suggest per-category spending limits via Claude instead of requiring manual entry

### Phase 3 — Differentiation 📋
- [ ] **Couples/household mode** — shared access to payoff plan and finances; joint vs. individual view; needs auth + data model design
- [ ] **Lump-sum split across multiple cards** — current simulator applies full amount to one card
- [ ] **PDF/CSV export** — payoff plan, debt list, net worth history
- [ ] **Subscription cancellation workflow** — detected recurring charges surface a "how to cancel" link or direct integration
- [ ] **Reward profile updates** — quarterly TPG valuation refresh for `cardProfiles.js`

### Pre-Go-Live Gates 🔒
These are not needed for test users — only before public launch.

- [ ] **Plaid production credentials** — apply via dashboard.plaid.com; free Trial plan (10 Items) now auto-approved; swap `PLAID_ENV=sandbox` → `production`
- [ ] **Stripe freemium gate** — Pro subscription for unlimited AI insights; `is_pro` flag already in Firestore schema; needs Stripe Checkout + webhook to flip the flag
- [ ] **Plaid webhooks** — push transaction updates instead of polling; required for real-time data feel at scale

### Later 📋
- [ ] React Native + Expo — iOS + Android (both Monarch and Origin have native apps; PWA is a gap)
- [ ] Push notifications — due dates, promo APR expiry, debt payoff milestones
- [ ] Retirement readiness calculator — simple "on track / off track" based on current trajectory

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| UI library | shadcn/ui (New York style) — 15 components |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), CSS-first `@theme inline` with oklch color tokens |
| Icons | lucide-react |
| Charts | recharts wrapped by shadcn `ChartContainer` |
| Drag-and-drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Auth | Firebase Authentication (email/password + Google) |
| Database | Firestore (Firebase Admin SDK, server-side) |
| API | Express.js → Firebase Cloud Functions |
| Hosting | Firebase Hosting (SPA) + Cloud Functions (API) |
| Bank data | Plaid API v29 (Transactions + Liabilities) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Monorepo | npm workspaces |
| Deploy | `firebase deploy` |

**Firebase project:** `zeroed-3331d`  
**Production URL:** [zeroed-3331d.web.app](https://zeroed-3331d.web.app)  
**Repository:** [github.com/thezeroedapp-ai/zeroed](https://github.com/thezeroedapp-ai/zeroed)
