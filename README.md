# ikigai

A personal dashboard for goals, finances, habits, health, and daily flow.

The core app is vanilla HTML/CSS/JS storing everything in `localStorage` — no framework needed. An optional TypeScript + Vite + Supabase **cloud-sync layer** (`src/`) is bolted on top without touching any feature module: it observes `localStorage` and syncs across devices. With Supabase credentials absent, the app runs fully local-only (no auth, no sync), exactly as before.

## Features

**Home** - Day ring (time-blocked progress), daily goals with drag reorder and streaks, tomorrow planning, performance stats (deep work, completion rate, readiness, weekly chart, 7-day consistency), drag-sortable timeline with recurring blocks and templates, monthly calendar with goal dots, daily insight summaries, mood logging with 30-day sparkline, live weather via OpenWeatherMap.

**Finances** - Income/expense tracking with tags, yearly savings chart, tag-based donut charts, savings goals, tag management, client-side paystub OCR (image or PDF). Views: year, quarterly, month. Work in progress - fully implemented in `js/finances.js` but not currently loaded; the tab shows a placeholder.

**Habits** - 9 fixed presets (journal, productive tasks, personal hygiene, reading, etc.), per-habit consistency and streaks, weekly heatmap, 28-day trend sparklines, weekly focus suggestions, edit/reorder via settings modal (drag handle).

**Health** - Daily readiness ring (6 blended factors), water/sleep/exercise logs, date navigation, nutrition tracking (calories + macros), 14-day trends, 7-factor recovery rating, configurable goals, JSON export/import.

**Gym** - Work in progress.

**System** - First-run setup (name, city, accent), 9 accent themes (Demon Slayer palette), light/dark theme toggle, sidebar with custom avatar, mobile responsive, works fully offline (except optional weather and CDN-loaded fonts/icons).

**Cloud Sync** (optional) - OAuth sign-in (Google / GitHub), offline-first cross-device sync via Supabase. Last-Write-Wins conflict resolution, incremental pull, realtime updates, durable mutation queue in IndexedDB. Theme/accent/macro preferences sync live with no reload. Disabled automatically when Supabase creds are absent.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Core app | Vanilla HTML / CSS / JS (IIFE pattern), served from `public/` |
| Storage | `localStorage` (live cache), IndexedDB (sync state) |
| Sync layer | TypeScript + Vite, bundled from `src/main.ts` |
| Backend | Supabase (Postgres + RLS + Realtime + OAuth), optional |
| Design | Custom CSS (~7.2K lines, custom properties, light/dark themes) |
| Fonts | Geist, JetBrains Mono, Cormorant Garamond (Google Fonts) |
| Icons | Lucide (CDN) + inline SVGs |
| OCR | Tesseract.js + PDF.js (`public/vendor/`) |
| Weather | OpenWeatherMap free API (optional) |
| Drag Sort | SortableJS (`public/vendor/`) |

The core vanilla app needs no build. The sync layer requires Vite to bundle `src/main.ts`.

## Getting Started

### Local-only (no build)

```bash
python -m http.server 8000   # serve repo root
# or
npx serve .
```

### With Vite (and optional cloud sync)

```bash
npm install
cp .env.example .env         # add Supabase creds (optional)
npm run dev                  # Vite dev server, port 5173
```

| Command | Action |
|---------|--------|
| `npm run dev` | Vite dev server (legacy app served from `public/`) |
| `npm run build` | `tsc --noEmit && vite build` → `dist/` |
| `npm run typecheck` | Strict type check (CI/build gate) |
| `npm run preview` | Serve built `dist/` |
| `npm run db:types` | Regenerate `src/sync/db-types.ts` from linked Supabase project |

Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env` to enable auth + sync. Both absent ⇒ local-only mode. The anon key is browser-safe; RLS protects data.

First launch shows a setup overlay (name, city, accent), then the sign-in overlay (or "Continue offline"). All optional - configure later.

## Data Storage

Live app data lives in `localStorage`. Key patterns: `goals:YYYY-MM-DD`, `habits:*`, `mood:*`, `health:YYYY-MM-DD`, `health_settings`, `timeline_blocks_v2` (`timeline_blocks_v1` legacy), `recurring_blocks_v1`, `schedule_templates_v1`, `weather_config_v1`, `weather_cache_v1`, `tweak_accent`, `tweak_theme`, `clock_format_v1`, `sidebar_user_name_v1`, `sidebar_user_avatar_v1`, `goal_streak_v1`, `focus_session_v1`, `dashboard_setup_v1`. Dormant finances module uses `finances_data_v1`.

When sync is enabled, the layer mirrors a registered subset of these keys to 4 Supabase tables (`profiles`, `settings`, `habits`, `entries`), all owner-scoped via RLS. Durable sync state (mutation queue, pull cursors, LWW shadows) lives in IndexedDB (`ikigai-sync`). Adding a new synced key requires registering it in `src/sync/mappers.ts`.

## Project Structure

```
index.html              ← Core app entry (~40KB, inline)
public/                 ← Served verbatim at site root
  css/styles.css        ← All styles (~7.2K lines)
  js/
    shared.js           ← Utilities (pad2, escHtml)
    sidebar.js          ← User name, avatar
    goals.js            ← Home tab (goals, calendar, stats, focus)
    finances.js         ← Finances tab (full impl, not loaded)
    habits.js           ← Habits tab
    health.js           ← Health tab
    gym.js              ← Gym tab (no-op stub)
    tabs.js             ← Tab routing
    home.js             ← Home widgets (timeline, weather, insights)
  vendor/
    tesseract/          ← Tesseract.js (OCR)
    pdfjs/              ← PDF.js
    sortable.min.js     ← SortableJS
    weather-icons/      ← Weather SVGs
  assets/avatars/       ← Avatar images per accent
src/                    ← Cloud-sync layer (TypeScript, bundled)
  main.ts               ← Bundle entry / boot sequence
  auth/                 ← OAuth (Google / GitHub)
  sync/                 ← Engine, mappers, migration, db-types
  storage/              ← localStorage interceptor, IndexedDB queue
  config/               ← Supabase client
supabase/migrations/    ← Schema (4 tables, RLS, realtime)
```

## FAQ

**API key?** Only for weather. Get one at [openweathermap.org](https://openweathermap.org). Everything else works offline.

**Data sent anywhere?** Not unless you enable cloud sync. Without Supabase creds, all data stays in `localStorage` and paystub OCR runs client-side. With sync on, your data syncs to your own owner-scoped (RLS) Supabase rows after OAuth sign-in.

**Browser support?** Modern Chrome, Firefox, Safari, Edge, Zen.

## License

MIT
