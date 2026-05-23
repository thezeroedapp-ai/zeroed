# Zeroed — Design System Reference

> **Read this before touching any CSS or inline styles.** This is the single source of truth for what tokens, classes, and patterns exist. All UI changes must use these — no magic numbers, no one-off hex values, no inline styles for things already covered here.

Source of truth: [`apps/web/src/index.css`](apps/web/src/index.css)

---

## Design Tokens

### Color — Surfaces

| Token | Value | Use |
|---|---|---|
| `--bg` | `#07090f` | Page background |
| `--bg-card` | `#0d1424` | Card surfaces (`.card`, `.bank-group`, etc.) |
| `--bg-input` | `#080d1c` | Input/select backgrounds |
| `--bg-elevated` | `#111c2e` | Nested surfaces, hover states, scenario cards |
| `--bg-nav` | `#080c18` | Sidebar navigation background |

### Color — Accent (Violet)

| Token | Value | Use |
|---|---|---|
| `--accent` | `#7c3aed` | Primary buttons, active states, focus rings |
| `--accent-2` | `#a78bfa` | Text on accent backgrounds, active nav |
| `--accent-dim` | `rgba(124,58,237,0.12)` | Active pill/tab background, focus card bg |
| `--accent-border` | `rgba(124,58,237,0.3)` | Active pill/tab border, focus/input focus border |

### Color — Status

| Token | Value | Dim token | Use |
|---|---|---|---|
| `--red` | `#f43f5e` | `--red-dim` `rgba(244,63,94,0.1)` | Debt, liabilities, errors, danger |
| `--green` | `#10b981` | `--green-dim` `rgba(16,185,129,0.1)` | Savings, credits, success, on-track |
| `--amber` | `#f59e0b` | `--amber-dim` `rgba(245,158,11,0.1)` | Warnings, off-track, approaching limit |
| `--blue` | `#3b82f6` | `--blue-dim` `rgba(59,130,246,0.1)` | Informational, investment accounts |

### Color — Text

| Token | Value | Use |
|---|---|---|
| `--text` | `#e2e8f0` | Primary text — headings, values, labels |
| `--text-2` | `#64748b` | Secondary text — sublabels, metadata, placeholders |
| `--text-3` | `#334155` | Tertiary — input placeholders only |

### Color — Borders

| Token | Value | Use |
|---|---|---|
| `--border` | `rgba(255,255,255,0.07)` | Standard card/row borders |
| `--border-2` | `rgba(255,255,255,0.13)` | Input/select borders (slightly more visible) |

### Compat Aliases (do not use for new code)

These exist for backward compatibility with old inline styles. Use the canonical tokens above for all new code.

| Alias | Maps to |
|---|---|
| `--text-sm` | same as `--text-2` |
| `--yellow` | same as `--amber` |
| `--yellow-light` | same as `--amber-dim` |
| `--blue-light` | same as `--blue-dim` |
| `--green-light` | same as `--green-dim` |
| `--red-light` | same as `--red-dim` |
| `--gray` | `#6b7280` (use `--text-2` instead) |
| `--gray-light` | `rgba(255,255,255,0.06)` |
| `--white` | `#ffffff` |

### Spacing & Shape

| Token | Value | Use |
|---|---|---|
| `--pad` | `16px` | Standard card padding, horizontal page padding |
| `--radius` | `16px` | Cards, bank groups, modals |
| `--radius-sm` | `10px` | Buttons, inputs, inner elements |
| `--nav-h` | `60px` | Bottom nav height; used in `padding-bottom` on `.content` |
| `--shadow` | `0 0 0 1px var(--border), 0 4px 20px rgba(0,0,0,0.35)` | Card elevation (use sparingly) |
| `--shadow-sm` | `0 0 0 1px var(--border), 0 1px 6px rgba(0,0,0,0.25)` | Subtle elevation |

### Typography

No custom font loaded — uses system stack: `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif`

All currency values and percentages must have `font-variant-numeric: tabular-nums` to prevent layout shift.

| Scale | Size | Weight | Use |
|---|---|---|---|
| Hero value | 38px | 800 | Main dashboard stat (`.hero-value`) |
| Stat value | 24px | 800 | Secondary stats (`.stat-value`) |
| Section title | 11px | 700 | Uppercase section headers (`.section-title`) |
| Card label | 10px | 700 | Uppercase card labels (`.card-label`) |
| Body | 14–15px | 400–600 | Row text, descriptions |
| Sub | 12–13px | 400–500 | Metadata, secondary info |
| Micro | 11px | 400–600 | Badges, timestamps, helper text |

---

## Component Classes

### Layout

```
.page          — 480px centered column, full height (mobile)
.content       — page scroll area with bottom padding for nav
.top-bar       — sticky frosted-glass header with h1 + .sub
.app-shell     — flex root on tablet/desktop
.app-main      — content area right of sidebar
```

### Cards

```
.card          — standard surface: bg-card + border + radius + pad
.card-label    — 10px uppercase label at top of card
.section-title — 11px uppercase section separator (between cards)
.bank-group    — card variant for grouped accounts (same styles)
.focus-card    — card with accent border (priority/featured content)
```

**Rule:** Never create one-off card-looking divs with inline `background`/`border`/`border-radius`. Use `.card` and override only what's needed.

### Buttons

```
.btn           — base: inline-flex, 14px, 11px 20px padding, radius-sm
.btn-primary   — violet fill (#7c3aed); 1 per screen max
.btn-outline   — transparent + accent-2 text + accent-border
.btn-ghost     — transparent + text-2 + standard border
.btn-danger    — transparent + red text + red border (destructive only)
.btn-block     — full width
.btn-sm        — smaller padding (7px 14px, 13px font)
```

### Navigation Pills (subtabs + filters)

```
.pills         — horizontal scrollable row (hides scrollbar)
.pill          — individual tab/filter button
.pill.active   — accent-dim bg + accent-border + accent-2 text
```

**Rule:** All subtab bars use `<SubNav>` component. All filter rows use `.pills`/`.pill` directly.

### Badges

```
.badge         — inline pill, 11px, 2px 8px padding
.badge-blue    .badge-green    .badge-red    .badge-yellow    .badge-gray
```

### Progress Bars

```
.progress-wrap   — wrapper with margin
.progress-bar    — track: 6px height, rgba white bg, rounded
.progress-fill   — fill: animated width transition
  .progress-fill.green   — green gradient (healthy)
  .progress-fill.yellow  — amber gradient (approaching limit)
  .progress-fill.red     — red gradient (over budget)
  .progress-fill.blue    — violet gradient (general purpose)
.progress-labels — space-between row below bar
```

### Forms

```
.form-group    — margin-bottom wrapper
.form-group label — 13px 500 weight text-2
input, select  — bg-input, border-2 border, radius-sm, 15px, full width
input:focus    — accent-border
```

### States

```
.loading-state — centered spinner + text (padding 56px)
.error-state   — centered error-icon + message + retry button
.empty         — centered empty-icon + message + hint
.spinner       — 28px rotating border animation
.skeleton      — shimmer placeholder (for loading content shapes)
```

### Alerts

```
.warning       — amber-dim bg, flex row with .warn-icon + .warn-title + .warn-desc
.focus-card    — accent-bordered card for priority content
```

### Bento Grid (Dashboard only)

```
.bento         — mobile: flex column; tablet: 2-col grid; desktop: 4-col grid
.bento-hero    — spans 2 cols (tablet), 2 cols (desktop)
.bento-stat    — 1 col
.bento-chart   — 2 cols (tablet), 3 cols (desktop)
.bento-focus   — 2 cols (tablet), 1 col (desktop)
.bento-full    — full width (all breakpoints)
.bento-ai      — 2 cols
.bento-goals   — 2 cols
```

**Rule:** Bento is Dashboard-only. All other pages use `.card` stacks.

### Hero Stats

```
.hero-value    — 38px 800 weight, tabular-nums, line-height 1
.hero-meta     — 12px flex row below hero value
.hero-date     — accent-2 colored date within hero-meta
.stat-value    — 24px 800 weight; modifier: .red .green .accent
.stat-sub      — 11px text-2 beneath stat value
```

### Utility Classes

```
.mt-8  .mt-12  .mt-16   — margin-top
.mb-8                   — margin-bottom
.text-sm                — 13px
.text-xs                — 11px
.text-secondary         — color: text-2
.text-green  .text-red  .text-blue
.fw-600  .fw-700        — font-weight
.flex-between           — justify-content: space-between, align-items: center
```

---

## Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| Mobile `< 768px` | Single column, 480px max, bottom nav |
| Tablet `≥ 768px` | 68px icon sidebar, no bottom nav, content up to 860px |
| Desktop `≥ 1024px` | 220px labeled sidebar, content up to 1100px, 4-col bento |

---

## Rules & Anti-Patterns

**DO:**
- Use CSS token variables for every color, spacing, and radius value
- Use component classes (`.card`, `.btn-primary`, `.section-title`) before reaching for inline styles
- Use `font-variant-numeric: tabular-nums` on all currency/percentage displays
- Use `.loading-state`, `.error-state`, `.empty` for all async data states

**DON'T:**
- Use hardcoded hex values inline (e.g., `color: '#7c3aed'` → use `color: 'var(--accent)'`)
- Use magic pixel values for spacing — use `--pad`, `--radius`, `--radius-sm`, or `8/12/16px` multiples
- Create new card-looking surfaces without `.card`
- Add `background`/`border-radius`/`padding` inline when a class already exists
- Use compat alias tokens (`--text-sm`, `--yellow`, etc.) in new code

---

## Current Gaps (to address in Phase 1)

| Gap | Plan |
|---|---|
| No `--font-mono` token | Add to `:root`; use for all numeric displays |
| `--text-3` only used for placeholders | Promote as the official tertiary text token |
| Compat alias tokens still used in some inline styles | Sweep and replace in Phase 1 |
| No standard widget card class for Dashboard manager | Add `.widget-card` as a `.card` variant |
| No skeleton pattern per widget | Add per-widget skeleton shapes |
| No drag-and-drop reorder CSS | Needed for Dashboard manager edit mode |

---

## Chart Colors (Recharts)

All charts use this ordered palette:

```js
const CHART_COLORS = [
  '#7c3aed', // accent (violet)
  '#a78bfa', // accent-2 (light violet)
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#f43f5e', // red
  '#06b6d4', // cyan
];
```

Area charts (debt projection): `stroke: var(--accent)`, `fill: var(--accent-dim)`

---

## Gradients

```css
/* Auth logo + sidebar Z logo */
background: linear-gradient(135deg, var(--accent-2) 0%, #c084fc 100%);

/* Progress bar — green */
background: linear-gradient(90deg, #059669, #10b981);

/* Progress bar — amber */
background: linear-gradient(90deg, #d97706, #f59e0b);

/* Progress bar — red */
background: linear-gradient(90deg, #f43f5e, #fb7185);

/* Progress bar — violet (general) */
background: linear-gradient(90deg, var(--accent), var(--accent-2));
```
