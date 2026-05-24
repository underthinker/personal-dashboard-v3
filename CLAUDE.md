# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Serve `index.html` with any static server:

```bash
python -m http.server 8080
# or
npx serve .
# or just open index.html directly in a browser (file://)
```

There are no tests, no linter, and no CI. Verify changes by opening the page in a browser.

## Architecture

Vanilla HTML/CSS/JS — no framework, no build tool, no package manager.

- **`index.html`** — the entire app. All tab HTML lives here; scripts are loaded at the bottom in a specific order that must be preserved (`index.html:1331–1337`).
- **`css/styles.css`** — ~7.6K lines. Single file. CSS custom properties drive theming; `--accent` and `--accent-soft` are the two live-overridden vars.
- **`js/*.js`** — each file is an IIFE that writes to `window.*` for cross-module calls.
- **`vendor/`** — Tesseract.js (OCR) and PDF.js, bundled locally, no CDN. Paystub import runs OCR entirely client-side in a WebWorker; max file size 8 MB.
- **Google Fonts** (Inter, JetBrains Mono, Cormorant Garamond) — loaded from CDN, requires internet for correct rendering.

## Script load order (must not change)

```
shared → goals → finances → habits → health → tabs → gym
```

`tabs.js` calls `window.render*` functions defined by the earlier modules, so it must load after them. `gym.js` must be last.

## Module / localStorage ownership

| File | `window.*` exports | localStorage prefix |
|------|-------------------|---------------------|
| `shared.js` | `pad2`, `escHtml` | — |
| `goals.js` | `showConfirm`, `showAlert`, `updateGreeting`, `renderStatsPanel`, `renderCalendar` | `goals:YYYY-MM-DD`, `mood_home:YYYY-MM-DD`, `clock_format_v1`, `quick_notes_v1`, `tweak_*` |
| `finances.js` | `renderGoals` (financial savings goals), `renderFinances`, `toggleGroup`, `deleteIncome`, `deleteExpense` | `finances_data_v1` |
| `habits.js` | `renderHabits`, `renderHabitFullRings`, `renderHomeHealthRings` | `habits:*`, `mood:*` |
| `health.js` | `renderHealth`, `getFocusMinToday`, `addFocusMin` | `health:YYYY-MM-DD`, `health_settings` |
| `tabs.js` | — (navigation only) | — |
| `gym.js` | `renderGym` | `po_coach_v1` |

## Cross-module communication

- `goals.js` fires `CustomEvent('goals-changed')` on any goal mutation.
- `goals.js` fires `CustomEvent('focus-updated')` on focus timer changes (not `health.js`).
- `health.js` fires `CustomEvent('nutrition-updated')` on meal add/delete.
- `index.html`'s inline `<script>` (home tab init) listens for all three events to refresh home widgets; `nutrition-updated` and `focus-updated` both call `renderHomeHealthRings`.

## Key conventions

- **Date keys**: all daily data uses `YYYY-MM-DD`. The "active day" rolls over at 6 AM, not midnight (late nights count as the same day). See `health.js` and the mood/goals logic.
- **`escHtml`** (from `shared.js`) must wrap any user-supplied string before injecting into `innerHTML`.
- The Tweaks panel (`index.html:1262–1294`) manages `--accent` / `--accent-soft` at runtime and persists the choice to `localStorage('tweak_accent')`. Clock format is a 4-state integer stored in `clock_format_v1` (0=12h+sec, 1=12h, 2=24h+sec, 3=24h).

## First-load seeding

- **Gym** seeds a default PPL split on first load; rotation is anchored to `2026-05-12`.
- **Finances** seeds 3 months of sample data on first load.
- **Weather** requires an OpenWeatherMap API key saved to `weather_config_v1` localStorage; without it the widget shows a config form.

## Known dead code

- `js/goals.js:4` — an unused API key placeholder (dead code, not functional).
- `@supabase/supabase-js@2` is loaded from CDN but not integrated anywhere.
