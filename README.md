# ikigai

A personal dashboard — your own command center for goals, finances, habits, health, and daily flow. Zero frameworks, zero build tools, zero backend. Just a single HTML file and some vanilla JS.

## Features

### 🏠 Home Tab
- **Day Ring** — Circular progress ring that tracks your day through configurable time blocks (morning → afternoon → evening → night)
- **Today's Plan** — Daily goals with inline editing, drag reorder, completion tracking, and streak counter
- **Tomorrow's Plan** — Plan ahead with a separate list that rolls over
- **Performance Overview** — Deep work time (with edit), task completion rate, readiness score, weekly bar chart, and 7-day consistency dots
- **Timeline** — Drag-sortable daily schedule with inline editing, recurring blocks (daily/weekdays/weekly), undo delete, and saveable templates with auto-apply
- **Calendar** — Monthly calendar with goal completion dots per day, clickable to view day details
- **Insights** — AI-flavored daily insights based on goals, mood, and health data
- **Mood** — Daily mood logging with 8 options (motivated → sad) and a 30-day sparkline
- **Weather** — Live weather via OpenWeatherMap with auto-refresh, sunrise/sunset, and activity recommendations

### 💰 Finances Tab
- **Income & Expense Tracking** — Add, edit, delete entries with tags, dates, and amounts
- **Savings Chart** — Yearly line chart with per-month breakdown
- **Donut Charts** — Income vs expense breakdown by tag
- **Financial Goals** — Set and track savings goals
- **Tag Management** — Create, rename, delete tags for income and expenses
- **Paystub Import** — Upload a paystub image or PDF; OCR runs entirely client-side (Tesseract.js + PDF.js). You review before saving.
- **Period Views** — All year, quarterly, or per-month views

### ✅ Habits Tab
- **Default Habits** — Journal, productive tasks, hygiene, healthy meals, no alcohol, go outside, creativity, no fap, reading, meditation, exercise, nofap night
- **Habit Overview** — Per-habit consistency %, streak, and 30-day trend (arrows)
- **Weekly Heatmap** — Color-coded consistency grid for the current week
- **Insights & Focus Areas** — AI-flavored habit insights and suggested focus areas
- **Emoji Picker** — Customize habit icons with searchable emoji grid
- **Settings** — Add, rename, delete, reorder habits

### ❤️ Health Tab
- **Daily Snapshot** — Readiness ring, water log, sleep log, exercise log with goal tracking
- **Date Navigation** — Browse any past (or future) day with arrow buttons or date picker
- **Quick Log** — Log sleep (hours + bedtime) and water (preset oz + custom input)
- **Nutrition** — Add meals with name, calories, protein, carbs, fat; per-day macro totals and goal bars
- **Health Trends** — 14-day trend charts for sleep, water, calories, and readiness
- **Recovery** — Rate 6 recovery factors (sleep quality, stress, energy, muscle soreness, nutrition quality, mood) on 1–7 sliders
- **Readiness Breakdown** — Factor-by-factor bar chart showing what drives your readiness score
- **Settings** — Configurable goals: water, sleep, calories, protein, carbs, fat, focus minutes
- **Export / Import** — Download all health data as JSON; re-import later

### 🏋️ Gym Tab
- Work-in-progress

### ⚙️ System Features
- **First-Run Setup** — Name, city/weather key, accent color
- **Accent Colors** — 9 themes named after the Demon Slayer Hashira (Kanroji, Shinobu, Sanemi, Giyu, Rengoku, Iguro, Uzui, Tokito, Himejima)
- **Sidebar** — Editable name, custom avatar (upload or Hashira defaults per accent), focus timer status indicator
- **Mobile Responsive** — Bottom tab bar on narrow screens
- **No Account, No Signup, No Tracking** — Everything stays in your browser

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | Vanilla HTML / CSS / JS (ES5/IIFE pattern) |
| Storage | `localStorage` only |
| Design System | Custom (~6K lines CSS, CSS custom properties) |
| Fonts | Geist (sans), JetBrains Mono (mono), Cormorant Garamond (serif) via Google Fonts |
| Icons | Lucide (via CDN) + inline SVGs |
| OCR | Tesseract.js + PDF.js (bundled in `vendor/`) |
| Weather | OpenWeatherMap free API (optional) |
| Drag Sort | SortableJS (in `vendor/`) |

**No frameworks, no package manager, no build step.** Open `index.html` in any browser and it works.

## Getting Started

```bash
# Option 1: Open directly
open index.html

# Option 2: Serve locally
python -m http.server 8000
# or
npx serve .
```

On first launch, a setup overlay asks for your name, city (for weather), and preferred accent color. All optional — you can skip and configure later.

## Data Storage

Everything is in `localStorage`. No server, no API calls (except optional OpenWeatherMap). Data keys:

| Key Pattern | Module |
|-------------|--------|
| `goals:YYYY-MM-DD` | Goals |
| `finances_data_v1` | Finances |
| `habits:*` | Habits |
| `mood:*` | Habits |
| `health:YYYY-MM-DD` | Health |
| `health_settings` | Health goals |
| `po_coach_v1` | Gym (PPL split) |
| `timeline_blocks_v2` | Timeline |
| `recurring_blocks_v1` | Recurring schedule blocks |
| `schedule_templates_v1` | Timeline templates |
| `weather_config_v1` | Weather API config |
| `weather_cache_v1` | Weather response cache |
| `tweak_accent` | Accent color |
| `sidebar_user_name_v1` | Sidebar name |
| `sidebar_user_avatar_v1` | Custom avatar (data URL) |
| `goal_streak_v1` | Goal streak state |
| `focus_session_v1` | Focus timer state |
| `dashboard_setup_v1` | First-run completion flag |

## Project Structure

```
index.html              ← Single entry point (882 lines)
css/
  styles.css            ← Design system + all styles (~6.2K lines)
js/
  shared.js             ← pad2, escHtml, date helpers
  sidebar.js            ← User name, avatar
  goals.js              ← Home tab: goals, day ring, streak, calendar, stats, mood
  finances.js           ← Finances tab: income/expense, charts, import
  habits.js             ← Habits tab: overview, heatmap, insights
  health.js             ← Health tab: snapshot, nutrition, trends, settings
  gym.js                ← Gym tab (stub)
  tabs.js               ← Tab routing & navigation
  home.js               ← Home tab widgets: timeline, weather, insights, etc.
vendor/
  tesseract/            ← Tesseract.js (OCR)
  pdfjs/                ← PDF.js
  sortable.min.js       ← SortableJS (drag reorder)
9 Hashiras/             ← Avatar images per accent color
```

## FAQ

**Do I need an API key?** Only for weather. Get a free key at [openweathermap.org](https://openweathermap.org). Everything else works offline.

**Is my data sent anywhere?** No. All data stays in `localStorage` on your machine. Paystub OCR runs completely client-side.

**Can I reset my data?** Clear `localStorage` in your browser dev tools, or click through the Settings panel per module.

**Browser support?** Modern browsers (Chrome, Firefox, Safari, Edge). Not tested on IE.

## License

MIT
