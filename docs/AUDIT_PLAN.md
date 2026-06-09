# ikigai — Audit Fix Plan (remaining)

Tracks fixes from the production-readiness audit (2026-06-09).

**Already shipped** (branch `refactor/home-grid-fold`):
- ✅ C1 — XSS: escaped `habits.js:1504` (`def.name`) + `finances.js:1095` (tag `displayName`). Full innerHTML audit done; all other user-data sites already safe (`escHtml`/`gtEscape`/`textContent`).
- ✅ C3 — render-blocking libs: `defer` on Tesseract + PDF.js; pinned Lucide `@latest`→`@1.17.0`. Sortable/Lucide kept blocking (used at init).
- ✅ N4 — removed 3 dead empty `card-head` divs + dead `View health` button.
- ✅ H2 — card tiering: uniform surface (no muddy fill); primary action cards (session/goals/timeline/habits) keep `--line-2` border + accent label, ambient cards (stats/activity/mood/weather/calendar) get `--line` border + `--muted` labels. CSS-only, `styles.css`.
- ✅ H3 — timer gating: all 9 `setInterval` callbacks early-return on `document.hidden` (home.js 2, goals.js 4, habits.js 3). No render/CPU on backgrounded tabs. Timers left intact (no teardown) for zero orphan risk.

Everything below is **not yet done**.

---

## Critical

### C2 — Weather requires user's own OpenWeatherMap API key
- **Problem**: setup wizard + weather card ask user to paste their own API key (`index.html` setup modal; `home.js renderWeatherSetup`). Key stored in `localStorage.weather_config_v1`, called direct from browser (`home.js:734` `api.openweathermap.org/...&appid=` + key).
- **Why**: no consumer pastes an API key; also exposes key client-side. Hard SaaS adoption blocker.
- **Fix**: server-side proxy. Add a Supabase Edge Function (or small serverless route) holding one server key; client calls `/api/weather?city=` → function fetches OWM, returns trimmed JSON. Drop the API-key input from setup + weather setup form. Keep city input only.
- **Impact**: adoption unblock + no client key leak. **Difficulty**: Med. **Score 9.**

### C4 — localStorage rehydrate blows up at scale
- **Problem**: 5yr health/habits/mood/goals = ~7,300 date-keyed `localStorage` blobs; `pullAll()` rehydrates all into synchronous `localStorage` (~5MB cap) on every device.
- **Why**: app stops working past the cap; main-thread jank on pull.
- **Fix**: move historical/cold data to IndexedDB as primary; keep `localStorage` for hot recent window (e.g. last 60 days). Window the pull (cursor already per-table). Lazy-load older entries on demand (calendar/trends views fetch ranges).
- **Impact**: app survives multi-year data. **Difficulty**: High. **Score 8.**

---

## High Impact

### H1 — Four overlapping "today/task" widgets
- **Problem**: Session card (Day Ring + Current Focus + Next Up), Goals (Today's Plan), Tomorrow, Timeline — 3 representations of one dataset across 3 corners.
- **Fix**: fold Current Focus / Next Up into the Timeline as a highlighted active row; reclaim Session card for the ring only. Merge the temporal story.
- **Impact**: faster morning check-in, less eye-bounce. **Difficulty**: Med. **Score 8.**

### H2 — No visual primary action ✅ DONE
- **Problem**: every card shares identical chrome (`--surface`/`--line`/`--r`, 10px uppercase accent label). Daily actions (add goal, check task) have no elevation over ambient cards. Accent spent on every label = means nothing.
- **Fix**: tier the surfaces — primary action cards get stronger border/elevation; reserve accent labels for them; demote ambient (weather/mood/calendar) to muted labels.
- **Impact**: biggest daily-feel upgrade. **Difficulty**: Low. **Score 8.**

### H3 — Timers run on hidden tabs / backgrounded doc ✅ DONE
- **Problem**: 9+ `setInterval` (1s focus timer, 5s ticker, 60s timeline/weather) fire regardless of active tab or `document.hidden`.
  - `goals.js:617,1527,1538,1623`, `habits.js:752,924,1461`, `home.js:863,912`.
- **Fix**: gate ticks on `document.visibilityState === 'visible'` and active tab; pause/resume on `visibilitychange`.
- **Impact**: battery/CPU. **Difficulty**: Low. **Score 7.**

### H4 — Readiness score shown 3×
- **Problem**: Performance Overview (`#perfReadiness`), Health snapshot, habits mini-rings all surface readiness.
- **Fix**: one home surface owns it; others link to it.
- **Impact**: clarity. **Difficulty**: Low. **Score 7.**

### H5 — Performance Overview crams 3 mental models
- **Problem**: `a-stats` stacks Deep Work hero + 7-bar week chart, dual metrics (Task Completion + Readiness), and 7-dot consistency strip in the densest column.
- **Fix**: keep hero; demote consistency dots to a sparkline; consider moving Readiness out (see H4).
- **Impact**: reduce overwhelm. **Difficulty**: Med. **Score 7.**

---

## Medium

### M1 — Dual radius + shadow token scales
- `--r`/`--r-sm` vs `--radius-xl`/`--radius-2xl`/`--radius-full`; 6 shadow tokens. Consolidate to one scale, migrate usages. Low. Score 6.

### M2 — Glow tokens hardcode green ✅ DONE
- `--shadow-glow-sm`/`-md` = `rgba(107,227,164,…)` (not even a palette token). Won't follow accent theming. Rebind to `--accent-rgb`. Low. Score 6.
- **Done**: rebound both to `rgba(var(--accent-rgb),…)` (`styles.css:47-48`). Tokens were defined-but-unused, now theme-correct for future use.

### M3 — Inline styles + `[style*=]` selectors
- HTML carries `style="flex:1;display:flex…"` on goals/tomorrow bodies; CSS matches `.home-grid .a-tomorrow > div[style*="flex:1"]` (line 437) — fragile substring selector. Promote to real classes. Med. Score 6.

### M4 — Accessibility wiring ✅ DONE
- `aria-current="page"` on active `.nav-item`; `aria-label` on calendar `‹`/`›` (`#calPrev`/`#calNext`) and bare `+` add buttons; `role="tabpanel"` + `aria-hidden` linking tab panels to nav buttons. Med. Score 6.
- **Done**: `aria-current="page"` toggled in `tabs.js` (+ initial in HTML); `aria-label` on `#calPrev`/`#calNext` (Previous/Next month), `#goalAddBtn` (Add goal), `#tomorrowAddBtn` (Add task for tomorrow); `role="tabpanel"` on all 5 `.tab-content` with `aria-hidden` toggled in `tabs.js`. Also added missing `type="button"`.

### M5 — Micro-label contrast fails AA ✅ DONE
- `--muted-2` (`#5e5e68`) on `--surface` (`#131316`) ≈ 3.6:1 for 10–11px labels. Darken surface text or lift `--muted-2`. Low. Score 6.
- **Done**: dark `--muted-2` `#5e5e68`→`#7e7e88` (≈4.6:1 on `#131316`); light `--muted-2` `#8c8c96`→`#71717b` (≈4.5:1 on `#faf9f7`). Both now AA.

### M6 — Goals have no dedicated tab
- Full `goals.js` engine (1,652 lines) but goals only appear as "Today's Plan". 50-goal user has nowhere to see goals as goals. Add a Goals view/tab. High. Score 5.

---

## Nice-to-have

- **N1** — Command palette / keyboard nav (Arc/Linear/Claude parity for a power-user daily tool). Score 4.
- **N2** — Collapse mood + weather + calendar into one slim ambient strip instead of 3 full cards. Score 4.
- **N3** — Split 7,467-line `styles.css` into `@layer` + per-feature files; adopt a naming convention. Score 4.
- **N5** — Fold `max-height` ceiling so rows 1–2 don't over-stretch on 27"+ monitors (current `0.72fr`/`0.78fr` split tuned to one 14" viewport). Score 3.
- **Lucide self-host** — `@1.17.0` still a runtime unpkg CDN dep (offline-break + supply-chain). Self-host the UMD (or bundle via Vite). Score 4.

---

## Suggested order
1. C2, C4 (critical, unblock SaaS + scale)
2. H2 (cheap, biggest daily feel) → H1, H5 (layout) → H3, H4
3. M-tier design-system cleanup (M1/M2/M3) in one pass; M4/M5 a11y pass; M6 when goals get a home
4. N-tier polish
