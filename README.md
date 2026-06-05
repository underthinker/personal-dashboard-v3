# ikigai

A personal dashboard for goals, finances, habits, health, and daily flow. Zero frameworks, zero build tools, zero backend - just a single HTML file and vanilla JS.

## Features

**Home** - Day ring (time-blocked progress), daily goals with drag reorder and streaks, tomorrow planning, performance stats (deep work, completion rate, readiness, weekly chart, 7-day consistency), drag-sortable timeline with recurring blocks and templates, monthly calendar with goal dots, daily insight summaries, mood logging with 30-day sparkline, live weather via OpenWeatherMap.

**Finances** - Income/expense tracking with tags, yearly savings chart, tag-based donut charts, savings goals, tag management, client-side paystub OCR (image or PDF). Views: year, quarterly, month. Work in progress.

**Habits** - Default set (journal, exercise, reading, etc.), per-habit consistency and streaks, weekly heatmap, weekly focus suggestions, customizable icons.

**Health** - Daily readiness ring, water/sleep/exercise logs, date navigation, nutrition tracking (calories + macros), 14-day trends, 6-factor recovery rating, configurable goals, JSON export/import.

**Gym** - Work in progress.

**System** - First-run setup (name, city, accent), 9 accent themes, light/dark theme toggle, sidebar with custom avatar, mobile responsive, fully offline (except optional weather).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | Vanilla HTML / CSS / JS (IIFE pattern) |
| Storage | `localStorage` only |
| Design | Custom CSS (~7.2K lines, custom properties, light/dark themes) |
| Fonts | Geist, JetBrains Mono, Cormorant Garamond (Google Fonts) |
| Icons | Lucide (CDN) + inline SVGs |
| OCR | Tesseract.js + PDF.js (`vendor/`) |
| Weather | OpenWeatherMap free API (optional) |
| Drag Sort | SortableJS (`vendor/`) |

No frameworks, no package manager, no build step. Open `index.html` in any browser.

## Getting Started

**Live**: [https://underthinker.github.io/personal-dashboard-v3/](https://underthinker.github.io/personal-dashboard-v3/)

```bash
# Serve locally
python -m http.server 8000
# or
npx serve .
```

First launch shows a setup overlay (name, city, accent). All optional - configure later.

## Data Storage

All data in `localStorage`. Key patterns: `goals:YYYY-MM-DD`, `finances_data_v1`, `habits:*`, `mood:*`, `health:YYYY-MM-DD`, `health_settings`, `po_coach_v1`, `timeline_blocks_v2`, `recurring_blocks_v1`, `schedule_templates_v1`, `weather_config_v1`, `weather_cache_v1`, `tweak_accent`, `tweak_theme`, `sidebar_user_name_v1`, `sidebar_user_avatar_v1`, `goal_streak_v1`, `focus_session_v1`, `dashboard_setup_v1`.

## Project Structure

```
index.html              ← Entry point (~980 lines)
css/styles.css          ← All styles (~7.2K lines)
js/
  shared.js             ← Utilities (pad2, escHtml, date helpers)
  sidebar.js            ← User name, avatar
  goals.js              ← Home tab
  finances.js           ← Finances tab (stub)
  habits.js             ← Habits tab
  health.js             ← Health tab
  gym.js                ← Gym tab (stub)
  tabs.js               ← Tab routing
  home.js               ← Home widgets (timeline, weather, insights)
vendor/
  tesseract/            ← Tesseract.js (OCR)
  pdfjs/                ← PDF.js
  sortable.min.js       ← SortableJS
  weather-icons/        ← Weather SVGs
assets/
  avatars/              ← Avatar images per accent
```

## FAQ

**API key?** Only for weather. Get one at [openweathermap.org](https://openweathermap.org). Everything else works offline.

**Data sent anywhere?** No. All data stays in `localStorage`. Paystub OCR runs client-side.

**Browser support?** Modern Chrome, Firefox, Safari, Edge, Zen.

## License

MIT
