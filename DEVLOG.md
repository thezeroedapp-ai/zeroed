# Zeroed — Dev Log

> One entry per work session. Log what was built, what was decided, and what's next. Keep this updated — it's the running history of how the product evolved and why decisions were made.

---

## 2026-05-23

### v5.3 — Glass UI Design System + Dark/Light Theme Toggle

**Why:** The UI was always-dark with no toggle, no elevation system, and flat opaque nav bars. User requested glass UI / material design aesthetic with consistent spacing and a dark/light toggle. Goal: look like a premium consumer fintech product, not a developer side project.

**What changed:**

**Theme system (`apps/web/src/context/ThemeContext.tsx` — new file):**
- `ThemeProvider` with `useTheme()` hook — `theme: 'dark' | 'light'` + `toggle()` function
- Reads initial theme from `localStorage.getItem('zeroed-theme')`, defaults to `'dark'`
- Applies/removes `html.dark` class via `useEffect` on theme change
- Persists to `localStorage` on every change
- `toggle()` adds `html.theme-transitioning` class before state change, removes it after 280ms — enables smooth CSS transitions only during the toggle (not during normal interactions, which avoids GPU overhead)

**No-flash init (`apps/web/index.html`):**
- Added inline `<script>` before `</head>` that reads `localStorage.getItem('zeroed-theme')` and adds `.dark` to `<html>` synchronously before React renders. Without this, dark-mode users see a white flash on load. Script is one line: `(function(){var t=localStorage.getItem('zeroed-theme')||'dark';if(t==='dark')document.documentElement.classList.add('dark');})();`

**`App.tsx`:** Wrapped `<AuthProvider>` with `<ThemeProvider>` — outermost context since theme doesn't depend on auth.

**CSS overhaul (`apps/web/src/index.css`):**

Theme structure:
- `:root` = light theme (new) — `oklch(0.97 0.007 264)` background, `oklch(1 0 0)` cards, status colors darkened for WCAG contrast on white (`--green: oklch(0.40 0.15 162)`, `--red: oklch(0.46 0.22 22)`, `--amber: oklch(0.46 0.17 82)`)
- `html.dark` = dark theme (moved from `:root`) — original dark palette unchanged
- `--violet-light` differs by theme: dark = `oklch(0.72 0.14 290)` (light lavender for dark bg), light = `oklch(0.42 0.22 290)` (deep violet for white bg — maintains WCAG AA contrast)
- `--gradient-to` CSS var for gradient text second stop — dark: `oklch(0.82 0.12 310)` (light mauve), light: `oklch(0.62 0.19 310)` (medium violet-pink). Both `.gradient-text` and `.auth-logo` now use `var(--gradient-to)` instead of hardcoded oklch

Glass utilities added:
- `.glass` — `backdrop-filter: blur(20px) saturate(180%)` + `-webkit-` prefix
- `.side-nav` — glass sidebar with `var(--nav-bg)` background + `var(--shadow-nav)` side shadow. Replaces hardcoded `bg-[var(--nav-bg)]` on SideNav.
- `.bottom-nav` — glass bottom bar with `var(--nav-bg)`. Replaces hardcoded `bg-[color:oklch(0.075_0.018_262/92%)]` (dark-mode-only color).
- `.top-bar` — `color-mix(in oklch, var(--background) 88%, transparent)` + blur. Uses native CSS `color-mix()` for opacity (more reliable than Tailwind's `/85` modifier with oklch CSS vars).
- `.card-hero` — `box-shadow: var(--shadow-hero)`. In dark mode this includes a 80px oklch violet ambient glow.

Elevation shadow system:
- `--shadow-card`: soft card shadow (light: `0 1px 3px + 0 4px 16px`, dark: `0 2px 8px oklch(0 0 0 / 35%) + 1px ring`)
- `--shadow-elevated`: stronger shadow for dialogs, sheets
- `--shadow-hero`: hero card — plus violet glow in dark (`0 0 80px oklch(0.49 0.21 290 / 14%)`)
- `--shadow-nav`: directional sidebar shadow
- In `@theme inline`: `--shadow-sm: var(--shadow-card)` and `--shadow-md: var(--shadow-elevated)` — overrides Tailwind's default shadow values. Since shadcn `Card` uses `shadow-sm` by default, every card in the app automatically gets elevation-aware shadows without touching any component code.

Page background:
- `body` now has `background-image: radial-gradient(ellipse 70% 45% at 65% -10%, oklch(0.49 0.21 290 / 10%) 0%, transparent 70%)` — violet bloom in the upper-right corner. In dark mode this is a visible purple glow; in light mode it's a very subtle tint. This gives glass cards something to reveal behind them via `backdrop-filter`.

Theme transition:
```css
html.theme-transitioning *, ... {
  transition: background-color 0.22s ease, border-color 0.22s ease, color 0.22s ease, box-shadow 0.22s ease, fill 0.22s ease !important;
}
```
Applied only while toggling — not on every mouse interaction.

**SideNav.tsx rewrites:**
- Replaced `bg-[var(--nav-bg)] border-r border-border` → `side-nav border-r border-border` (CSS class)
- Added `Sun` and `Moon` imports from lucide-react
- Added `useTheme()` import
- Replaced `mt-auto` on admin NavLink with explicit `<div className="flex-1" />` spacer — cleaner than CSS auto-margin trick
- Added theme toggle button (Sun/Moon icon + label) at very bottom of sidebar, with `Tooltip` on icon-only (md) viewport
- Extracted `itemClass()` helper to deduplicate active/inactive nav link styles

**BottomNav.tsx:**
- Changed `'bg-[color:oklch(0.075_0.018_262/92%)] backdrop-blur-xl'` → `'bottom-nav'` — removes dark-mode-only hardcoded color; now theme-aware

**Dashboard.tsx:**
- Top bar: `'backdrop-blur-xl border-b border-border bg-background/85'` → `'top-bar border-b border-border'` (CSS class, avoids Tailwind oklch opacity modifier issues)
- Hero card: added `card-hero` CSS class for violet-glow shadow; changed `mb-4` → `mb-5` for breathing room; border changed from `border-border` → `border-[var(--primary)]/20` for a subtle violet tint

**Decisions:**
- **Default dark, not default light** — Zeroed's brand is dark. Light mode is a toggle for users who want it, not the primary experience.
- **`html.dark` class strategy (not `prefers-color-scheme` media query)** — user preference should override system preference. The Sun/Moon toggle lets users set their own preference regardless of OS setting.
- **`color-mix()` for top bar opacity** — Tailwind's `bg-background/85` opacity modifier is unreliable with oklch CSS custom properties in v4. `color-mix(in oklch, var(--background) 88%, transparent)` is a direct CSS solution that works in all modern browsers.
- **Shadow override via `@theme inline`** — instead of adding `.shadow-*` classes to every card, overriding `--shadow-sm` in `@theme inline` means all existing shadcn cards get elevation-aware shadows automatically. One change, global effect.
- **`backdrop-filter` only where it matters** — didn't apply glass to every card (GPU cost). Glass on: sidebar (always visible), bottom nav (always visible), top bar (sticky, always visible), hero card (main focal point). Widget cards get elevation via shadow only.
- **No `useLayoutEffect` for theme init** — the `index.html` inline script handles the initial class synchronously. `useEffect` in `ThemeContext` handles subsequent toggles. The 1-frame delay on toggle is imperceptible and avoids SSR issues.

---

### v5.2 — shadcn/ui + Tailwind v4 Migration

**Why:** The hand-rolled CSS design system was showing cracks — subtle alignment bugs, inconsistent card sizing, no component hierarchy, and chart widgets that looked out of place across screens. The goal was a polished consumer-fintech UI with better charts and drill-down capability. Evaluated Tremor and Nivo; chose shadcn/ui because it gives the most control (copy-paste, not a dependency to fight), pairs natively with recharts (already installed), and Tailwind v4 removes all config friction.

**What changed:**

**Infrastructure (Tailwind v4 + shadcn/ui setup):**
- Added `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` to `apps/web/package.json`
- `apps/web/vite.config.ts`: added `tailwindcss()` plugin (first in array), added `'@': path.resolve(__dirname, './src')` alias
- `apps/web/tsconfig.app.json`: added `"@/*": ["./src/*"]` to `paths` for TypeScript resolution
- `apps/web/components.json`: shadcn config (`style: "new-york"`, `rsc: false`, `tsx: true`, CSS variables on)
- `apps/web/src/lib/utils.ts`: `cn()` helper — `clsx` + `tailwind-merge`
- `apps/web/src/index.css`: complete rewrite — `@import "tailwindcss"`, `@import "tw-animate-css"`, `@theme inline` block mapping shadcn CSS vars to Tailwind color utilities, `:root` block defining all tokens in oklch. Kept `.spinner`, `.skeleton`, `.gradient-text`, `.widget-grid`, `.pills`, auth page classes.

**shadcn/ui components installed** (`apps/web/src/components/ui/`):
`avatar`, `badge`, `button`, `card`, `chart`, `dialog`, `input`, `label`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `tabs`, `tooltip` — 15 components.

> **Windows path gotcha:** `npx shadcn@latest add` on Windows creates a literal `@/` directory at `apps/web/@/components/ui/` instead of resolving `@/` to `src/`. Fixed by: `cp -r "apps/web/@/components/ui/." "apps/web/src/components/ui/"` then `rm -rf "apps/web/@"`.

**Color system (`apps/web/src/index.css`):**
All oklch values — chosen to match the existing hex palette exactly so the visual change was upgrade, not redesign:

| Token | oklch | Hex equiv | Use |
|---|---|---|---|
| `--background` | `oklch(0.065 0.015 264)` | `#07090f` | Page background |
| `--card` | `oklch(0.105 0.024 258)` | `#0d1424` | Card surfaces |
| `--primary` | `oklch(0.49 0.21 290)` | `#7c3aed` | Violet accent |
| `--violet-light` | `oklch(0.72 0.14 290)` | `#a78bfa` | Text on accents, active states |
| `--green` | `oklch(0.70 0.16 162)` | `#10b981` | Positive values |
| `--red` | `oklch(0.64 0.22 22)` | `#f43f5e` | Debt, expenses |
| `--amber` | `oklch(0.78 0.19 82)` | `#f59e0b` | Warnings |
| `--blue` | `oklch(0.62 0.20 264)` | `#3b82f6` | Charts |

**Navigation rewrites:**
- `SideNav.tsx`: lucide-react icons (Home, Target, CreditCard, TrendingUp, Settings, Shield), `hidden md:flex`, `w-[68px] lg:w-[220px]`, gradient "Z"/"Zeroed" logo. At md (collapsed): icon-only 40×40 squares, `Tooltip` on hover. At lg (expanded): icon + label side by side.
- `BottomNav.tsx`: `md:hidden`, lucide-react icons, Tailwind active state (`text-violet-light`).
- `SubNav.tsx`: replaced `.pills`/`.pill` CSS with Tailwind + `cn()` — `rounded-full` pills with violet active state.

**Layout fix (`Layout.tsx`):**
Critical bug: the original layout used `flex min-h-dvh` as the wrapper with `SideNav` fixed (removed from flow). `flex-1 ml-[68px]` on the content div was theoretically correct (flex free-space calculation accounts for margins) but caused content to render overlapping the sidebar in practice. Switched to a non-flex approach: `SideNav` fixed, `<main className="md:ml-[68px] lg:ml-[220px]">` as a plain block. Sidebar content is now always fully visible.

**Dashboard.tsx — complete rewrite:**
- Drill-down state: `sheet: { open: boolean; type: 'spending'|'networth'|'goal'|null; payload? }` drives a shadcn `Sheet` that slides in from the right.
- `SortableWidgetShell` updated: lucide `GripVertical` + `X` icons, shadcn `Card` as the drag wrapper.
- Three `ChartConfig` objects for recharts color/label mapping (`debtChartConfig`, `netWorthChartConfig`, `spendingChartConfig`).
- Widget changes: `debt_projection` → `ChartContainer` + `AreaChart` (height 150px); `net_worth_trend` → clickable, opens Sheet with expanded line chart + assets/liabilities breakdown; `spending_by_category` → horizontal `BarChart` with `Cell` per-bar colors, each bar clickable, opens Sheet with full category list + `Progress` bars; `goals_progress` → clickable rows open Sheet with goal details.
- Hero card redesigned: two-column top (Total Debt + Monthly Interest Cost), three-column stat strip (Minimums / Surplus / Net Worth). Removed the always-full red `Progress` bar (conveyed nothing). Subtle violet gradient background via `bg-gradient-to-br`.
- Default widget order rebalanced for better 2-column pairing: (Projection, Spending) → (Net Worth, Priority Attack) → (Goals, AI Insights) → Alerts.

**Plan.tsx — complete rewrite:**
Strategy selector: 2×2 grid of visual cards with emoji icons (🔥❄️⚖️💸), strategy name, sub-description, "best for" `Badge`. Active strategy: violet ring (`ring-1 ring-[var(--primary)]`). All other plan UI migrated to shadcn `Card`, `Input`, `Button`, `Select`, `Label`, `Progress`.

**Accounts.tsx — complete rewrite:**
Net worth strip: 3-column `Card` grid. Accounts by institution: `Card` per bank with accounts inside, `Badge` for APR/min/limit/due date. Inline edit: shadcn `Input`/`Label`/`Button`. Budget: `Progress` with `[&>div]:bg-red/green/amber` modifier. Rewards: 4-column category grid + shadcn `Card` per recommendation.

**Spending.tsx — complete rewrite:**
Transactions: `Card` list with colored icon circles (green ✅ for payments, 🛍️ for purchases). Trends: shadcn `ChartContainer` + recharts stacked `BarChart`. Recurring: annual total hero `Card` + per-item rows with `Badge` for category.

**Settings.tsx — complete rewrite:**
All shadcn `Card`/`Input`/`Label`/`Select`/`Button`. Income save: flash feedback (button turns green for 2s → "✓ Saved"). Plaid items: error banner, Reconnect/Disconnect buttons with `border-red/30 text-red hover:bg-red/10` styling.

**Login.tsx + Signup.tsx — rewrite:**
shadcn `Input`/`Label`/`Button`. Error state: inline red banner (`bg-red/10 border-red/25`) replacing `.auth-error`. Auth page layout CSS classes (`auth-logo`, `auth-card`, `auth-title`, `auth-divider`, `auth-footer`) restored to `index.css` — they were in the old CSS but omitted from the first shadcn pass.

**TypeScript fixes:**
- `Dashboard.tsx`: removed unused `ResponsiveContainer` import; typed `BarChart` `onClick` handler as `(d: any)` to avoid `activePayload` not-on-type error.
- `Settings.tsx`: removed unused `Badge` import.
- `Spending.tsx`: removed unused `Cell` and `ResponsiveContainer` imports.

**Decisions:**
- **shadcn/ui over Tremor** — Tremor would have locked chart aesthetics and constrained customization. shadcn wraps recharts directly and lets us control everything.
- **Always-dark, no toggle** — Zeroed's brand is dark. Adding a light mode now would require auditing every color decision twice with no user demand.
- **oklch everywhere** — Tailwind v4 is designed around oklch; using it throughout gives better color mixing (e.g. `primary/10` alpha modifiers work predictably in the perceptual color space).
- **`@theme inline` bridge** — Maps shadcn's CSS var names (`--background`, `--primary`, etc.) to Tailwind utility names (`bg-background`, `text-primary`). One block in `index.css` makes the whole system work without any `tailwind.config.js`.
- **Drill-down as Sheet, not modal** — Sheet slides in from the right without blocking the chart that triggered it; the user can see the chart and the detail simultaneously at wider viewports.

---

### v5.1 — Drag-and-Drop Dashboard + Demo Seed Data

**What changed:**

**Drag-and-drop widget reordering (`apps/web/src/pages/Dashboard.tsx`):**
- Replaced the ↑/↓ button reorder system with `@dnd-kit/core` + `@dnd-kit/sortable` (added to `apps/web/package.json`)
- `SortableWidgetShell` component wraps each widget: uses `useSortable`, renders a `⠿` drag handle (top-left, `setActivatorNodeRef`) and a `×` remove button (top-right) — both only visible in edit mode. Handle activates drag so card content (buttons, charts, links) stays interactive.
- Sensors: `PointerSensor` (8px distance threshold) + `TouchSensor` (200ms delay, 8px tolerance) — distinguishes intentional drag from scroll on touch devices
- `DragOverlay` renders a ghost of the active widget at `transform: scale(1.02)` with violet drop shadow during drag
- `handleDragEnd` calls `arrayMove` then `persistConfig` — auto-saves debounced 600ms after every drag, add, or remove (no Save button needed)
- Widget grid: uniform `.widget-grid` CSS class — 1-col mobile, 2-col tablet/desktop (768px+), `min-height: 180px` per card. Hero card (Total Debt) is pinned above the `DndContext` — always visible, not draggable.
- "Add Widgets" section below the grid in edit mode: hidden widget IDs shown as `btn-outline btn-sm` chips to add back to the grid
- Edit button in top-bar: `.btn-primary` (violet fill) when in edit mode, `.btn-ghost` otherwise

**React hooks fix:** `draftWidgets` `useState` was declared after a `useEffect` in an earlier draft — violates React rules of hooks. Fixed by moving all state declarations to the top of the component before all `useEffect` calls.

**CSS additions (`apps/web/src/index.css`):**
- `.widget-grid`: `display: grid; grid-template-columns: 1fr; gap: 12px;`
- `.widget-grid .card { min-height: 180px; overflow: hidden; }`
- `.widget-grid-full { grid-column: 1/-1; }`
- `@media (min-width: 768px)`: `.widget-grid { grid-template-columns: 1fr 1fr; gap: 12px; }`

**Comprehensive demo seed data (`scripts/seed-demo.js` — complete rewrite):**

UID: `eUD7KA6dMgbx6YcL2u6Q3jy43gn2` (Venkat / venkatrbade@gmail.com)

10 accounts:
- Cash: Chase Checking ($3,240), Joint Checking ($1,887), Marcus Savings ($18,400)
- Assets: Fidelity 401k ($87,650)
- Loans: Chase Mortgage ($312,450/6.75%), Toyota Camry ($18,750/5.9%), Honda CR-V ($9,200/4.5%)
- Credit cards: Citi ($12,450/19.99%/$249 min), Chase Sapphire ($7,820/22.49%/$156 min), Amex Gold ($4,340/29.99%/$87 min)

201 transactions across 6 months (Dec 2025 – May 2026):
- Per month: 8 recurring subs (Netflix $22.99, Spotify $11.99, Hulu $17.99, AT&T $165, Comcast $79.99, PG&E, Apple One $29.95, Equinox $185), 3x groceries ($85–$165), 5x dining ($18–$85), 3x gas ($45–$72), 2-3x shopping, health, 2x rideshare, 2 paychecks (-$4,250), mortgage/car/CC payments
- Seasonal: Dec (holiday shopping, travel), Feb (travel), May (Memorial Day)

6 net worth snapshots: Dec 2025 (-$264,200) → May 2026 (-$249,580) — ~$2,400/mo improvement arc

Also seeded: 3 goals, 7 budgets, 3 sinking funds ($600/mo total: Emergency $300, Car $150, Vacation $150), dashboard config (9 widgets), user profile ($8,500 income, $6,500 expenses → $908 surplus)

Script output:
```
✓ 10 accounts  (3 credit · 4 assets · 3 loans)
✓ 201 transactions across 6 months
✓ 6 net worth snapshots (Dec 2025 – May 2026)
✓ 3 goals · 7 budgets · 3 sinking funds ($600/mo total)
Credit card debt: $24,610, Net worth: -$253,832
```

**Decisions:**
- Auto-save (debounced 600ms) instead of a "Save Layout" button — cleaner UX; user sees changes immediately
- Touch sensor uses 200ms delay + 8px tolerance — tested threshold that reliably distinguishes swipe-to-scroll from drag intent
- Drag handle (`setActivatorNodeRef`) instead of full-card drag — keeps all interactive content (buttons, charts) clickable
- Demo data uses Dec 2025–May 2026 date range so "last 6 months" query windows populate correctly as of the current date
- `clearCollection()` at script start makes seed idempotent — safe to re-run

---

### v5.0 — Phase 1: Dashboard Overhaul

**What changed:**

**Design system lock-in:**
- Added `--font-mono` token to `:root` in `index.css` (Menlo/Consolas/Monaco fallback chain)
- Added `.widget-card`, `.widget-card-label`, `.widget-card-value` classes to `index.css` — standard card variant for dashboard widgets
- Confirmed compat alias tokens (`--text-sm`, `--yellow`, `--gray`, etc.) are not used in any TSX file — sweep is clean
- Updated `DESIGN.md` gaps section to reflect Phase 1 completion

**Net worth history (backend):**
- Added `recordNetWorthSnapshot(uid, accounts)` to `database.js` — computes `total_assets`, `total_liabilities`, `net_worth` from the accounts array, writes to `net_worth_history/{YYYY-MM}` with merge semantics (idempotent per month)
- Added `getNetWorthHistory(uid, limit=12)` to `database.js` — fetches ordered by doc ID (lexicographic = chronological for YYYY-MM), returns oldest-first for chart rendering
- `syncAllAccounts` in `plaidService.js` now calls `recordNetWorthSnapshot` after the sync loop completes, wrapped in try/catch so a snapshot failure never kills a sync
- Added `GET /api/net-worth-history` endpoint to `server.js`

**Dashboard manager (backend):**
- Added `getDashboardConfig(uid)` and `saveDashboardConfig(uid, widgets)` to `database.js` — reads/writes `dashboard_config/default` doc with `{ widgets: string[] }`; defaults to all 9 widgets if no doc exists
- Added `GET /api/dashboard-config` and `PUT /api/dashboard-config` endpoints to `server.js`

**Dashboard manager (frontend — `apps/web/src/pages/Dashboard.tsx`):**
- Complete restructure: fixed-order bento grid → dynamic `activeWidgets.map(renderWidget)` with hero widget pinned first
- Added `WIDGET_CATALOG` (9 widgets: debt_projection, net_worth_trend, spending_by_category, goals_progress, interest_cost, savings_rate, priority_attack, ai_insights, alerts)
- `load()` now fetches 5 in parallel: dashboard data, goals, net worth history, spending summary, dashboard config
- `renderWidget(id)` switch renders each widget as the correct bento card class; conditionally returns null if required data isn't available (e.g., no history for net_worth_trend)
- Edit mode: "Edit" button in top-bar; ↑/↓ reorder buttons + checkbox toggles (upgraded to dnd-kit drag-and-drop in v5.1)
- Net worth trend widget: Recharts `LineChart` with `ReferenceLine` at y=0, shows `δ` vs first month
- Spending by category widget: top-5 categories with CSS progress bars (no extra chart)
- Fixed Goals link: `/goals` → `/plan?tab=goals`

**Decisions:**
- Hero widget (Total Debt) is not configurable — it's always shown. The 9-widget system covers secondary widgets.
- Edit mode initially used ↑/↓ buttons; upgraded to dnd-kit drag-and-drop in v5.1
- Dashboard config saves as `string[]` (not a map) — order is layout order, presence = active
- Net worth snapshot uses `set({ merge: true })` so it overwrites the same YYYY-MM doc on re-sync — last sync of the month wins

---

### v4.5 — Plaid Production Readiness

**What changed:**

**Backend — `server/services/plaidService.js`:**
- Added `createUpdateLinkToken(uid, accessToken)` — creates a Plaid Link token in update mode (passes `access_token` instead of `products`). Used to re-authenticate a broken bank connection without disconnecting it.
- Added `removeItem(accessToken)` — calls `client.itemRemove()` to revoke the Plaid access token on Plaid's side. Previously, deleting a bank only removed it from Firestore; the access token lived forever.
- Replaced `transactionsGet` (old date-range API) with cursor-based `transactionsSync`. Key differences: incremental (only fetches new/changed since last sync), handles `added` + `modified` + `removed` arrays, paginates automatically via `has_more`, stores `next_cursor` on the plaid_item doc so each sync is a delta not a full re-pull.
- `syncAllAccounts` now catches `ITEM_LOGIN_REQUIRED` / `ITEM_NOT_FOUND` per-item instead of failing the whole sync. Marks `error_status` on the item in Firestore and continues to the next item.

**Backend — `server/routes/plaid.js`:**
- Added `POST /api/plaid/create-link-token/update` — takes `item_id`, looks up the access token, returns an update-mode link token.
- Added `DELETE /api/plaid/items/:itemId` — disconnect an entire bank institution: calls `removeItem` on Plaid, deletes all accounts + transactions for that item, deletes the plaid_item doc.
- Fixed `DELETE /api/plaid/accounts/:id` — now calls `removeItem` on Plaid before deleting the plaid_item doc when removing the last account for an institution.
- `GET /api/plaid/items` now returns `error_status` field per item.

**Backend — `server/db/database.js`:**
- Added `deleteTransactions(uid, transactionIds)` — batch-deletes transactions by ID (used by cursor sync to handle Plaid's `removed` array).

**Frontend — `apps/web/src/pages/Settings.tsx`:**
- Added Connect Bank flow: loads Plaid Link script dynamically (`cdn.plaid.com/link/v2/stable/link-initialize.js`), calls create-link-token, opens Link widget, exchanges token, syncs immediately.
- Added Reconnect flow: for items with `error_status === 'ITEM_LOGIN_REQUIRED'`, shows a red warning banner and Reconnect button; opens Link in update mode; syncs on success to clear the error.
- Added Disconnect button per institution (with confirm prompt).
- Added Sync Now button (manual trigger for all connected banks).
- Updated `PlaidItem` interface to include `error_status`.
- Bumped displayed app version to 4.4.

---

### Competitive Analysis — Monarch vs Origin vs Zeroed

Researched feature parity with Monarch Money ($99/yr or $15/mo) and Origin ($99/yr or $13/mo).

**Where Zeroed is ahead:**
- Debt payoff engine depth (4 strategies + freed-minimum rollover + lump-sum simulator + required-payment calculator) — neither competitor goes this deep
- Card recommendation engine with TPG valuations — unique in the market
- Freed-minimum rollover specifically is sophisticated math neither Monarch nor Origin implements

**Critical gaps vs competitors:**

| Gap | Priority |
|-----|----------|
| Credit score monitoring (Monarch has Spinwheel/VantageScore) | High |
| Net worth history chart (both show trends; Zeroed only shows today's snapshot) | High |
| Manual account entry (can't add medical debt, personal loans without Plaid) | High |
| Cash flow forecasting 3–6 months | Medium |
| Investment tracking (Plaid pulls accounts but Zeroed shows nothing) | Medium |
| Budget AI recommendations (both competitors auto-suggest limits) | Medium |
| Couples/household mode (both have it) | Medium |
| Native iOS/Android (both have native apps; Zeroed is PWA) | High (pre-launch) |

**Ruled out:**
- Rewards/points balance data: Plaid doesn't have it. Yodlee does but costs $1–2K/month minimum, fully sales-led — not viable pre-revenue.
- Retirement modeling, tax filing, estate planning: that's Origin's premium positioning, not Zeroed's identity. Don't chase it.

**Business model decision:** Both Monarch and Origin are pure subscription, no free tier. Zeroed's freemium model (10 AI insights/month free) is a user acquisition differentiator — keep it but make the Pro gate meaningful.

**Plaid pricing update (as of April 15, 2026):** New "Trial plan" replaces old Limited Production. Auto-approved, free, up to 10 Production Items. No 2–3 week review anymore. Plaid prod is ready to flip when needed.

---

### Strategic Decisions Made

**Build order: UI first, then features.**

Reasoning: Consumer fintech lives on first impressions. A test user decides in 10 seconds whether this feels like a real product. Polish the Dashboard and lock in the design system before building new features — otherwise each new screen inherits inconsistencies. The Dashboard's net worth history chart is both a UI win and a feature gap, so these overlap.

**Phase 1 (now):** Dashboard overhaul + design system + dashboard manager
**Phase 2:** Credit score, manual accounts, net worth history, cash flow forecast, investment tracking
**Phase 3:** Budget AI, couples mode, lump-sum split, export
**Pre-go-live:** Plaid production credentials, Stripe gate, Plaid webhooks

**Dashboard manager concept:** Users can add, remove, and reorder up to 9 chart widgets on the Home screen. Planned widgets: debt projection, net worth trend, cash flow forecast, spending by category, credit score, goals progress, upcoming bills, interest cost over time, savings rate. Implementation will need a widget config stored per user in Firestore (array of widget IDs + order).

---

### Design System Reference (DESIGN.md)

Created `DESIGN.md` — the canonical reference for all UI work. Documents every CSS token, component class, responsive breakpoint, chart color, gradient, and anti-pattern from the actual `index.css` (not aspirational spec). Cross-linked from README.

**Why:** Without a reference artifact, every new screen risks drifting — hardcoded hex values, magic pixel numbers, one-off card divs. Now the rule is: read `DESIGN.md` first, use the tokens and classes, document any new patterns added.

**Current gaps identified:** no `--font-mono` token, compat alias tokens still used in some inline styles, no `.widget-card` for dashboard manager, no drag-and-drop CSS yet. These are Phase 1 items.

Also fixed: `index.html` title changed from "Vite + React + TS" → "Zeroed"; README Node prereq updated to v22.

---

### v4.4 — Cloud Functions 2nd Gen + Node 22

**Why:** Deploy warnings after v4.3 ship — Node 20 deprecated (EOL 2026-10-30) and firebase-functions SDK v4 flagged as outdated.

**What changed:**
- `server/package.json`: `engines.node` 20 → 22; `firebase-functions` `^4.0.0` → `^5.1.0`
- `server/index.js`: migrated from v1 API to v2 API:
  - `functions.https.onRequest(app)` → `onRequest(app)` from `firebase-functions/v2/https`
  - `functions.pubsub.schedule().timeZone().onRun()` → `onSchedule({ schedule, timeZone }, handler)` from `firebase-functions/v2/scheduler`
  - v2 handler no longer needs `return null`

**Deployment gotcha:** Firebase does not support upgrading 1st Gen → 2nd Gen in place. Had to delete the existing functions first (`firebase functions:delete api dailySync --region us-central1 --force`) before redeploying. Brief downtime (~2 min) during the transition.

**After deploy:** Functions log shows `creating Node.js 22 (2nd Gen)` — both warnings gone.

**Remaining non-issue:** Firebase CLI still prints "outdated firebase-functions" even on v5.1.1 — this is the CLI's own check lagging behind; deploy succeeds cleanly and can be ignored.

---

### v4.3 — Tech Debt Cleanup + 5-Tab Nav Consolidation

**Goal:** Before building more features, clean up naming inconsistencies and consolidate the 8+ page nav into a 5-tab structure suitable for web, iOS, and Android.

**Tech debt cleaned up:**

- **`expenses` → `sinking_funds`**: Firestore collection renamed. `database.js` functions renamed (`getExpenses` → `getSinkingFunds`, etc.). Field name standardized to `monthly_amount` throughout — previously Firestore stored as `amount` but all readers expected `monthly_amount`, causing `sinkingTotal` to always show $0.
- **`recommendations` → `rewards`**: `server/routes/recommendations.js` rewritten as `rewards.js`. API routes now `/api/rewards/categories` and `/api/rewards`. Frontend page `Recommend.tsx` renamed `Rewards.tsx` (deleted — now absorbed into Accounts).
- **`Activity.tsx` → `Spending.tsx`**: Page and function name aligned.
- **`/activity` → `/spending`**, **`/recommend` → `/rewards`**: Routes, nav components, and `packages/core/index.ts` ROUTES constants all updated.
- **Old vanilla HTML deleted**: `server/public/` (11 files from pre-React v3.1) removed — these were dead code serving nothing.
- **Duplicate routes eliminated**: `expenses.js` had both `/api/expenses` and `/api/expenses/sinking-funds` doing the same thing. Rewritten as clean single-route `sinking-funds.js`.

**Nav consolidation — 8 pages → 5 tabs with subtabs:**

Previous structure: Dashboard, Plan, Goals, Accounts, Budget, Spending, Rewards, Settings (8 standalone pages).

New structure:
| Tab | Subtabs |
|-----|---------|
| Home | — (Dashboard unchanged) |
| Plan | Strategy · Goals · AI Insights |
| Accounts | Accounts · Budget · Rewards |
| Spending | Transactions · Trends · Recurring |
| Settings | — |

**Built:**
- `Plan.tsx` rewritten — absorbs full `Goals.tsx` content as a subtab; adds AI Insights subtab (`GET /api/insights/latest`, `POST /api/insights/generate`)
- `Accounts.tsx` rewritten — absorbs `Budget.tsx` and `Rewards.tsx` content as subtabs
- `Spending.tsx` — adds "💳 Using the right card?" teaser card in Transactions tab with "Explore cards →" deep link to `/accounts?tab=rewards`
- `SubNav.tsx` — new reusable horizontal subtab bar component using existing `.pills`/`.pill` CSS classes
- `BottomNav.tsx` + `SideNav.tsx` — reduced from 7–8 items to 5 tabs
- `App.tsx` — removed standalone `/goals`, `/budget`, `/rewards` routes; added legacy redirects so old bookmarks still work (`/goals` → `/plan?tab=goals`, `/budget` → `/accounts?tab=budget`, `/rewards` → `/accounts?tab=rewards`)
- Deleted: `Goals.tsx`, `Budget.tsx`, `Rewards.tsx` (all content absorbed)

**Implementation decisions:**
- URL search params (`?tab=goals`) for subtab navigation, not component state — enables deep links like `/accounts?tab=rewards` that work on page load and are shareable
- `useSearchParams` from React Router v6 reads and writes subtab state; default tab maps to no param (clean URL)
- Lazy-load pattern for subtabs: each subtab only fetches data on first visit using `'idle'` state check — same pattern Spending already used for Trends/Recurring
- Rewards debounce timer uses `useRef` (not `useState`) — avoids re-render loops and TypeScript array-index errors
- Cross-tab flow (Spending → Rewards) uses a URL link not internal state — simpler and survives page refresh

**Bugs fixed during rewrite:**
- `sinkingTotal` always $0: Firestore stored field as `amount`, all readers expected `monthly_amount`. Fixed by standardizing storage to `monthly_amount`.
- Accounts.tsx: imported `useNavigate` and assigned `navigate` but never used it — removed.
- Accounts.tsx: `debounceRef` initially typed as `useState` instead of `useRef` — caused `[0]`/`[1]` index errors. Fixed to `useRef<ReturnType<typeof setTimeout> | null>(null)`.

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
1. Multi-user auth: Supabase Auth, JWT scoping, remove hardcoded user_id = 1

---

## 2026-05-20 (continued)

### v2.1 — Supabase Live + NUMERIC Fix

**Supabase connected and verified working.**

**Bug found and fixed:** pg returns all `NUMERIC` columns as JavaScript strings by default. This caused string concatenation instead of numeric addition everywhere (e.g. minimum payments were `"719" + "277"` = `"719277"` instead of `996`). Dashboard showed `$0` total debt and `-$719,274,129` surplus.

**Fix:** Added a global pg type parser in `database.js`:
```js
const { Pool, types } = require('pg');
types.setTypeParser(1700, parseFloat); // 1700 = pg OID for NUMERIC
```
This converts all NUMERIC fields to JS floats at the driver level — no per-query casting needed anywhere else.

**Infrastructure note:** Supabase direct connections use IPv6 by default. Standard home/office networks are IPv4. Use the **Session Pooler** connection string (not Direct) — works on IPv4 and is the right choice for a persistent Express server.

**Architecture:** GitHub = code only (`.env` gitignored). Supabase = live database connected at runtime via `DATABASE_URL`. New devs clone from GitHub, add `.env`, connect to shared Supabase.

---

## 2026-05-22 (continued)

### v4.2 — Monarch/Origin Feature Parity + Production Deploy

**Goal:** Close the gap with Monarch Money and Origin — add all account types, net worth, budgets, spending trends, and recurring subscription detection. Ship to production.

**Built:**

**All Plaid account types:**
- `plaidService.js` was collapsing all non-credit accounts to `depository`. Fixed to pass through native Plaid `type` and `subtype` (`investment`, `loan`, `mortgage`, `brokerage`).
- `Accounts.tsx` fully rewritten: grouped by type (Cash & Savings, Investments, Credit Cards, Loans), net worth strip at top, subtype label shown below account name, APR/min edit only shown for credit accounts.

**Net worth:**
- Dashboard route in `server.js` extended: computes `totalAssets` (depository + investment + brokerage), `totalLiabilities` (credit + loan + mortgage), `netWorth = totalAssets - totalLiabilities`. All three returned in dashboard response.
- Dashboard hero card shows Assets / Net Worth inline row below main stats.
- Bug fixed: `sinkingTotal` was summing `e.amount` but Firestore stores it as `e.monthly_amount` — caused wrong surplus. Fixed to `e.monthly_amount || 0`.

**Budget system:**
- `server/routes/budgets.js` (new): GET enriches budgets with current-month `spent`, `remaining`, `pct` by fetching transactions in parallel; POST creates; DELETE removes.
- `server/db/database.js`: `getBudgets`, `upsertBudget`, `deleteBudget` added; `budgets` added to `deleteUserData`.
- `apps/web/src/pages/Budget.tsx` (new): preset category dropdown, monthly limit input, progress bars with green/amber/red coloring at 80%/100%, overall summary strip.
- Route registered in `server.js`: `app.use('/api/budgets', budgetsRoutes)`.

**Spending screen (renamed from Activity):**
- `Activity.tsx` rewritten with 3 tabs: Transactions, Trends, Recurring.
- Transactions tab: account name lookup from `accountMap[tx.account_id]`, filter by expenses (`amount > 0`) or payments (`amount < 0`), amount color (green for credits/payments, red for charges).
- Trends tab: `GET /api/transactions/trends` returns 6-month data (top 7 categories). Recharts `BarChart` with `stackId="a"` stacked bars, 7-color palette. TypeScript fix: recharts Tooltip `formatter` `name` param is `NameType | undefined`, must use `String(name ?? '')`.
- Recurring tab: `GET /api/transactions/recurring` groups by normalized description, finds 2+ distinct months, returns `avgAmount`, `annualEstimate`, `lastDate`. Annual total shown in hero.
- Trends + recurring lazy-load (only fetch on first tab select).

**Navigation:**
- `BottomNav.tsx` rewritten: 7 items — Home, Accounts, Plan, Budget, Spending, Reward, Settings. Goals removed from bottom nav.
- `SideNav.tsx` rewritten: 8 items — Home, Accounts, Plan, Budget, Goals, Spending, Reward, Settings. Goals stays in side nav.
- `App.tsx`: Budget route added (`/budget`).

**Decisions:**
- Lazy loading trends/recurring avoids slow API calls on tab load — only pay the cost when the user actually navigates there
- Recurring detection is pure server logic — no ML, just group by normalized description and count distinct months
- Budget categories use Plaid's own category names (Food and Drink, Travel, etc.) so they match transaction data without any mapping

---

### Firebase Production Deploy

First-ever production deploy. Lessons learned:

1. **Blaze plan required** — Firebase Cloud Functions needs the Blaze pay-as-you-go plan. Project was on free Spark plan; upgraded via console before deploy.
2. **GCP IAM permissions** — First deploy failed: `Storage Object Viewer` permission missing on `gcf-sources-537812060594-us-central1` bucket for `537812060594-compute@developer.gserviceaccount.com`. Fixed via GCP Console → IAM → grant Storage Object Viewer.
3. **Broken function state** — Second deploy got "Precondition failed" because the function was stuck in a failed CREATE state. Fixed by deleting the function: `firebase functions:delete api --region us-central1 --force`, then redeploying.
4. **Firebase account** — Must deploy with `thezeroedapp@gmail.com`, not personal account. `firebase logout && firebase login` before deploying.

Deploy command: `npm run deploy` (`npm run build:web && firebase deploy`)

**Live:** https://zeroed-3331d.web.app

---

### Mac + Windows Simultaneous Development Setup

Problem: `.env.local` (Firebase client config) was gitignored by the `*.local` pattern, so Mac users had to manually recreate it after cloning.

Solution:
1. `apps/web/.gitignore` — added `!.env.local` exception so the file is committed to git. Firebase client config is public by design (it's not a secret — it's the same config you paste into `<script>` tags on public websites).
2. `vite.config.ts` — proxy target now supports `API_TARGET` env var override: `process.env.API_TARGET ?? 'http://localhost:3000'`.
3. `package.json` — added `dev:web:remote` script: `cross-env API_TARGET=https://zeroed-3331d.web.app npm run dev --workspace=apps/web`. Added `cross-env` devDependency for cross-platform env var setting.
4. `.env.example` — documents all required server env vars with comments. AirDrop `.env` from Windows to Mac for full-stack dev.

**Mac dev workflows:**
- Full-stack: AirDrop `.env` from Windows, then `npm run dev` + `npm run dev:web`
- UI-only: `npm run dev:web:remote` — no server needed, proxies to production Firebase

---

### v4.1 — Dark Premium UI Redesign + Bug Fixes

**Goal:** Differentiate from Monarch/Origin with a debt-engine-first experience. Dark + premium aesthetic, interactive dashboards, bento grid layout.

**Built:**
- `apps/web/src/index.css` — complete rewrite. Dark design system: `#07090f` background, `#0d1424` card surfaces, violet accent (`#7c3aed` / `#a78bfa`). Compatibility aliases preserved so inline `var(--text-sm)`, `var(--blue-light)` etc. still resolve. Frosted-glass sticky top-bar and bottom nav via `backdrop-filter: blur`. Gradient progress bars, tabular-nums on all currency values.
- `apps/web/src/pages/Dashboard.tsx` — bento grid layout. Mobile: single column. Tablet (768px+): 2-column CSS grid. Desktop (1024px+): 4-column grid with named span classes (`bento-hero`, `bento-stat`, `bento-chart`, `bento-focus`, `bento-ai`, `bento-goals`). Recharts `AreaChart` renders a projected debt payoff curve from `totalDebt` + `debtFreeMonths` (new field returned by `/api/dashboard`). Curve uses an exponential decay approximating the freed-minimum rollover effect.
- Added `recharts` dependency to `apps/web`.

**Bug fixes:**
- `Recommend.tsx`: `fetchResults()` was calling plain `fetch()` without the Firebase auth token — changed to `apiFetch()`. Cards were returning 401 for all recommendation requests.
- `Goals.tsx`: `id` typed as `number` but Firestore returns string document IDs — changed to `string` throughout.
- `server/routes/plan.js`: Plan route now transforms engine output (`order`, `totalMonths`, `perCardTimeline`) into the shape `Plan.tsx` expects (`cards`, `months`, `scenarios`, `sinkingFundTotal`). Engine and frontend were never aligned until this fix.

**Design decisions:**
- Violet accent (`#7c3aed`) instead of blue — every other finance app uses blue; this creates immediate visual differentiation
- Bento grid only on Dashboard (the landing screen users see most) — other pages stay as clean card stacks to keep complexity low
- Chart generates a projected curve on the frontend from `debtFreeMonths`; no extra API call needed. Accuracy is approximate (exponential decay) but visually communicates the debt payoff trajectory clearly
- All existing class names preserved in new CSS — no breaking changes to components that weren't redesigned

---

## 2026-05-22

### v4.0 — Firebase Migration (Railway + Supabase → Firebase)

**Why:** Railway JWT secret corruption caused persistent 401 errors that couldn't be reproduced locally. Root cause was Railway corrupting the `SUPABASE_JWT_SECRET` env var, invalidating all existing tokens. Migrated to Firebase to eliminate the Railway dependency and consolidate to a single platform.

**What changed:**

- `server/db/database.js` — full rewrite. Replaced `pg` Pool with Firebase Admin SDK + Firestore. All user data in subcollections under `users/{uid}/`. `plaid_account_id` string = Firestore document ID (eliminates numeric-to-plaid mapping).
- `server/middleware/auth.js` — replaced `jsonwebtoken` + `SUPABASE_JWT_SECRET` with `admin.auth().verifyIdToken(token)`.
- `server/index.js` — new Cloud Functions entry: `exports.api = functions.https.onRequest(app)` + `exports.dailySync` scheduled function replaces node-cron in production.
- `server/server.js` — exports `app` for Cloud Functions; starts locally via `require.main === module` guard.
- All routes rewritten for Firestore: no SQL, no JOINs, subcollections, `req.user.uid` (string) throughout.
- `apps/web/src/lib/firebase.ts` — new Firebase client init.
- `apps/web/src/lib/api.ts` — `apiFetch` now attaches Firebase ID token (`auth.currentUser.getIdToken()`).
- `apps/web/src/context/AuthContext.tsx` — `onAuthStateChanged` replaces Supabase listener.
- `apps/web/src/pages/Login.tsx` + `Signup.tsx` — Firebase Auth SDK calls.
- `firebase.json` + `.firebaserc` + `firestore.rules` + `firestore.indexes.json` — new deploy config.
- Removed: `@supabase/supabase-js`, `pg`, `jsonwebtoken`, `DATABASE_URL`, `SUPABASE_*` env vars.
- Added: `firebase-admin`, `firebase-functions`, `firebase` (client SDK).

**Firestore schema decisions:**
- No `credit_details` subcollection — APR, minimum_payment etc. merged directly into account document on Plaid sync.
- `payoff_plans/{id}` uses embedded `items: [...]` array instead of a separate `plan_items` table.
- Timestamp serialization: `toObj()` helper converts Firestore Timestamp objects to ISO strings before JSON responses.

**Local dev:**
- `npm run dev` → Express on :3000 (reads `FIREBASE_SERVICE_ACCOUNT` from `.env`)
- `npm run dev:web` → Vite on :5173 (proxies `/api` to :3000)
- `FIREBASE_SERVICE_ACCOUNT` = full service account JSON on one line; Cloud Functions auto-initialize in production without it.

**Deploy:** `npm run deploy` = `npm run build:web && firebase deploy`

---

## 2026-05-21

### v3.2 — Monorepo Restructure + Responsive Web

**Built:**
- Monorepo directory structure: `server/` (Express), `apps/web/` (React), `packages/core/` (shared)
- `packages/core/index.ts` — shared `fmt()`, `fmtD()`, `ROUTES` constants; importable by any app in the monorepo
- Root `package.json` converted to npm workspaces: `apps/*`, `packages/*`
- `apps/web/vite.config.ts` — path alias `@zeroed/core → packages/core/index.ts`
- `apps/web/tsconfig.app.json` — matching `paths` entry so TypeScript resolves the alias
- `apps/web/src/components/SideNav.tsx` — left sidebar nav for tablet/desktop; same routes as BottomNav
- `apps/web/src/components/Layout.tsx` — shell wrapper: renders SideNav + BottomNav + page content
- `App.tsx` updated: `ProtectedRoute` wraps children in `Layout`; individual pages no longer import BottomNav
- Responsive CSS breakpoints in `index.css`:
  - Mobile (< 768px): bottom tab bar, 480px centered column (unchanged)
  - Tablet (768–1023px): 68px icon-only sidebar, bottom nav hidden, content full-width up to 860px
  - Desktop (≥ 1024px): 220px labeled sidebar, content up to 1000px, 4-column metrics grid

**Architecture:**
```
zeroed/
├── server/          ← Express API (was src/)
├── apps/web/        ← React + Vite (was client/)
├── packages/core/   ← shared TS (fmt, fmtD, ROUTES)
├── package.json     ← npm workspaces root
└── .env             ← root-level, loaded by server at startup
```

**Dev commands:**
- `npm run dev` — Express on :3000
- `npm run dev:web` — Vite on :5174 (proxies /api to :3000)
- `npm run build:web` — production build to `apps/web/dist`

---

### v3.1 — React + Vite Frontend Migration

**Built:**
- `client/` directory: Vite 5 + React 18 + TypeScript scaffold
- `client/src/index.css` — full design system ported from `style.css` (CSS variables, all component classes, auth page styles)
- `client/src/lib/supabase.ts` — lazy Supabase client initialization via `/api/config`
- `client/src/lib/api.ts` — `apiFetch()` (attaches JWT Bearer token), `fmt()`, `fmtD()` helpers
- `client/src/context/AuthContext.tsx` — React Context: session state, loading flag, `signOut()`; wraps entire app
- `client/src/components/BottomNav.tsx` — `NavLink`-based nav with active state via React Router
- `client/src/App.tsx` — React Router v6; `ProtectedRoute` + `PublicRoute` wrappers; all 9 routes
- 9 page components: `Login`, `Signup`, `Dashboard`, `Accounts`, `Plan`, `Goals`, `Activity`, `Recommend`, `Settings`

**Architecture:**
- Dev: Vite on `localhost:5174` proxies `/api/*` to Express on `localhost:3000`
- Production: `npm run build` outputs to `client/dist`; Express serves it
- Auth: same Supabase JWT pattern, now managed by React Context instead of global `auth.js`
- CSS: global CSS classes (no CSS modules) — same class names as the old HTML, zero visual regression

**Decisions:**
- TypeScript chosen for type safety and autocomplete as complexity grows
- Global CSS retained (not CSS modules) to keep migration 1:1 and avoid renames across all classes
- `client/` subfolder keeps Express backend source (`src/`) cleanly separated

---

### v3.0 — Multi-user Auth (Supabase Auth + Google OAuth)

**Built:**
- `src/middleware/auth.js` — JWT verification using `jsonwebtoken` + `SUPABASE_JWT_SECRET`; looks up user by `auth_id`; auto-creates profile on first OAuth login
- `auth_id TEXT UNIQUE` column added to `public.users` via `ALTER TABLE` + SQL migration
- DB trigger `on_auth_user_created` — fires on every `auth.users` INSERT, auto-creates `public.users` profile row with name from metadata
- `GET /api/config` — public endpoint serving `SUPABASE_URL` + `SUPABASE_ANON_KEY` to the frontend
- `app.use('/api', authenticate)` — all API routes now require a valid Supabase JWT
- `src/public/auth.js` — shared frontend helper: `getSupabase()`, `getSession()`, `requireAuth()`, `apiFetch()`, `signOut()`
- `login.html` + `signup.html` — email/password + Google OAuth; match existing mobile-first design
- All 7 pages: Supabase CDN + auth.js added to head; `fetch(` → `apiFetch(`; `requireAuth()` guard at top of init
- All routes: `user_id = 1` → `req.user.id`; account queries filter by `pi.user_id = $N`
- Dev seed removed from startup — real users create their own data via signup

**Decisions:**
- `auth_id TEXT` (not UUID FK) keeps schema simple, avoids cross-schema FK complexity with `auth.users`
- Profile creation in both trigger AND middleware fallback — handles OAuth timing edge cases
- Only `/api/config` and `/api/health` are public; everything else requires JWT
- New Supabase "Publishable key" UI: use Legacy anon tab for `eyJ...` format needed by `@supabase/supabase-js` v2

**What's next:**
- Enable Google OAuth in Supabase Auth settings + configure Google Cloud Console credentials
- Stripe freemium — Pro gate for unlimited AI; `is_pro` already in schema
- Plaid production credentials

---
