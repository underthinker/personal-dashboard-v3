# AGENTS.md — personal-dashboard-v3

Vanilla HTML/CSS/JS personal dashboard ("broken crayons"). No build tools, no package manager, no frameworks.

## Architecture

- **Single page**: `index.html` is the sole entrypoint. Serve it anywhere (`python -m http.server`, `npx serve`, or just `file://`).
- **Database**: `localStorage` only. No backend, no API calls except optional OpenWeatherMap weather widget.
- **Module pattern**: Each `.js` file is an IIFE that exports to `window.*` for cross-module communication. **Script load order matters** (`index.html:1331-1337`):
  `shared → goals → finances → habits → health → tabs → gym`
- **CSS**: Custom design system (~7.6K lines in `css/styles.css`). Uses CSS custom properties for theming. All colors derived from 5 accent presets stored in `tweak_accent` localStorage key.

## Tab ownership

| Tab | JS file | localStorage keys |
|-----|---------|-------------------|
| Home | `js/goals.js` | `goals:YYYY-MM-DD`, `mood_home:YYYY-MM-DD`, `clock_format_v1`, `quick_notes_v1`, `tweak_*` |
| Finances | `js/finances.js` | `finances_data_v1` |
| Habits | `js/habits.js` | `habits:*`, `mood:*` |
| Health | `js/health.js` | `health:YYYY-MM-DD`, `health_settings` |
| Gym | `js/gym.js` | `po_coach_v1` |
| Shared | `js/shared.js` | — (exports `pad2`, `escHtml`) |
| Tabs | `js/tabs.js` | — (nav routing, calls `window.render*` per tab) |

## Key conventions

- **Cross-module events**: `goals.js` dispatches `CustomEvent('goals-changed')` on goal mutations and `CustomEvent('focus-updated')` on focus timer changes. `health.js` dispatches `CustomEvent('nutrition-updated')` on meal add/delete. All three are listened to in `index.html`'s home-tab init script.
- **Date key convention**: All daily data uses `YYYY-MM-DD` format. Health tab considers the "active day" to start at 6 AM (so late nights still count as the same day).
- **No tests, no linting, no CI**. Verify changes by opening `index.html` in a browser.

## Vendor dependencies

- `vendor/tesseract/` — Tesseract.js (OCR for paystub import). Bundled locally, no CDN needed.
- `vendor/pdfjs/` — PDF.js. Bundled locally.
- `@supabase/supabase-js@2` — loaded from CDN but **not integrated**. No credentials configured.
- Google Fonts (Inter, JetBrains Mono, Cormorant Garamond) — loaded from CDN, requires internet.

## Setup & quirks

- Weather widget requires a free OpenMW API key (saved to `weather_config_v1` localStorage).
- Gym module seeds default PPL (Push/Pull/Legs) split on first load. Split rotation anchored to `2026-05-12`.
- Finances module seeds 3 months of sample data on first load.
- Paystub import runs OCR entirely client-side (Tesseract in WebWorker). Max file size 8 MB.
- An error-prone API key placeholder exists at `js/goals.js:4` — this is unused/dead code.
