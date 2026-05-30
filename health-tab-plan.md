# Health Tab Improvement Plan

## Execution order

Six batches, sequential. Each batch is self-contained and testable.

---

## Batch 1: Bug Fixes

### 1.1 — 6AM day boundary

**File:** `js/health.js:62-65`

Current `getActiveDate()` uses raw `new Date()`. Late-night sessions (2AM) log to wrong day.

**Fix:** Offset by -6h to align with 6AM rollover:

```js
function getActiveDate() {
  const now = new Date(Date.now() - 6 * 3600000);
  return dateToYMD(now);
}
```

**Verify:** All callers (`renderHealth`, `window.addFocusMin`, `window.getFocusMinToday`) use same function — they do, no further changes needed.

### 1.2 — AM/PM toggle drops minutes

**File:** `js/health.js:476-477`

```js
_spH = _to24h(t.hour, 0, t.ampm).hour;
//                          ^ should be _spM, not 0
```

**Fix:** Pass `_spM` instead of `0`.

### 1.3 — Duplicate nt-modal-bg CSS

**Files:** `css/styles.css:1359-1366` and `css/styles.css:5287-5299`

Two competing modal background definitions. First uses `display:none` / `display:flex` style. Second uses `[hidden]` attribute.

**Fix:** Keep second definition (line 5287, which uses `[hidden]`). Remove or replace first definition. Also ensure JS uses `hidden` attribute consistently (it already does: `bg.hidden = false` / `bg.hidden = true`).

### 1.4 — Rapid water button clicks

**File:** `js/health.js:338-343`

Each water click calls `saveDay` + `renderHealth` immediately. Rapid clicks can cause stale closure overwrites.

**Fix:** Add 200ms throttle around `renderHealth` calls. Track last render timestamp.

```js
let _lastRender = 0;
function _throttledRender() {
  const now = Date.now();
  if (now - _lastRender > 200) {
    _lastRender = now;
    renderHealth();
  }
}
```

Replace `renderHealth()` in water button handler with `_throttledRender()`.

---

## Batch 2: Recovery Slider Relocation

Move recovery sliders from Quick Log into the Recovery card so input + visualization live together.

### 2.1 — Remove sliders from Quick Log

**File:** `js/health.js:259-358`

- Remove `RECOVERY_SLIDERS` constant (move to module-level or recovery scope)
- Remove `slidersHtml` generation from `renderQuickLog`
- Remove slider event listener loop from `renderQuickLog`
- Remove `ql-rec-head`, `ql-divider`, `ql-sliders` related HTML from template

Quick Log becomes: Sleep + Water only.

### 2.2 — Add sliders to Recovery card

**File:** `js/health.js:517-554`

- Add slider HTML generation + event listeners to `renderRecovery`
- Sliders appear above the bar visualization
- Same 6 sliders, same 1-7 range, same data binding
- On slider `input`, update `day.recovery[key]`, `saveDay`, re-render snapshot + recovery bars

### 2.3 — Move/rename CSS

**File:** `css/styles.css:5040-5114`

- Rename `.ql-slider-*` → `.rc-slider-*` classes
- Move under the Recovery section comment block
- Keep same visual styles

### 2.4 — Delete unused Quick Log divider/head

**File:** `css/styles.css`

- Remove `.ql-divider`, `.ql-rec-head` if no longer used

---

## Batch 3: Date Navigation

Allow viewing and logging health data for any past date.

### 3.1 — Add view date state

**File:** `js/health.js` (top of IIFE)

```js
let _viewDate = null; // null = today
function _resolveViewDate() {
  return _viewDate || getActiveDate();
}
function setViewDate(dateStr) {
  _viewDate = dateStr || null;
}
```

### 3.2 — Update renderHealth to use view date

**File:** `js/health.js:1080-1092`

Replace `getActiveDate()` with `_resolveViewDate()` in `renderHealth`.

### 3.3 — Add date nav HTML

**File:** `index.html:518`

Insert before the first `.section` inside `#tab-health`:

```html
<div class="hl-date-nav">
  <button type="button" class="hl-date-prev" id="hlDatePrev" aria-label="Previous day">←</button>
  <div class="hl-date-display" id="hlDateDisplay">Today</div>
  <input type="date" class="hl-date-picker" id="hlDatePicker" aria-label="Pick date">
  <button type="button" class="hl-date-next" id="hlDateNext" aria-label="Next day">→</button>
  <button type="button" class="hl-date-today" id="hlDateToday">Today</button>
</div>
```

### 3.4 — Date nav CSS

**File:** `css/styles.css` (add under health tab section)

Style date nav as horizontal row with inline controls, consistent with design system (dark background, monospace date, subtle borders).

### 3.5 — Date nav event handlers

**File:** `js/health.js` (new function)

```js
function renderDateNav() {
  const viewDate = _resolveViewDate();
  const today = getActiveDate();
  const displayEl = $('hlDateDisplay');
  const pickerEl = $('hlDatePicker');

  if (viewDate === today) {
    displayEl.textContent = 'Today';
  } else {
    // Show formatted date
    const d = new Date(viewDate + 'T00:00:00');
    displayEl.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  pickerEl.value = viewDate;
}

function initDateNav() {
  const prev = $('hlDatePrev');
  const next = $('hlDateNext');
  const picker = $('hlDatePicker');
  const todayBtn = $('hlDateToday');

  prev.addEventListener('click', () => {
    const d = new Date(_resolveViewDate() + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setViewDate(dateToYMD(d));
    renderHealth();
  });

  next.addEventListener('click', () => {
    const d = new Date(_resolveViewDate() + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setViewDate(dateToYMD(d));
    renderHealth();
  });

  picker.addEventListener('input', () => {
    if (picker.value) {
      setViewDate(picker.value);
      renderHealth();
    }
  });

  todayBtn.addEventListener('click', () => {
    setViewDate(null);
    renderHealth();
  });
}
```

Call `initDateNav()` once at module init. Call `renderDateNav()` inside `renderHealth()`.

### 3.6 — Update getActiveDate callers for focus

**File:** `js/health.js:23-33`

`window.getFocusMinToday` and `window.addFocusMin` should still use real today (not view date) since they're called from the focus timer on the home tab.

- `window.getFocusMinToday` → keep `getActiveDate()`
- `window.addFocusMin` → keep `getActiveDate()`

---

## Batch 4: Settings UI

### 4.1 — Gear icon in HTML

**File:** `index.html:519`

Add gear icon next to "Today's Snapshot" title:

```html
<div class="section-title">
  Today's Snapshot
  <button type="button" class="hl-settings-toggle" id="hlSettingsToggle" aria-label="Health settings">⚙</button>
</div>
```

### 4.2 — Collapsible settings panel

**File:** `js/health.js` (new render function + toggle)

```js
let _settingsOpen = false;

function renderSettings() {
  const el = $('hlSettingsPanel');
  if (!el) return;
  el.hidden = !_settingsOpen;
  if (!_settingsOpen) return;

  const settings = getSettings();
  const fields = [
    { key: 'water_goal_oz', label: 'Water goal (oz)', type: 'number', min: 0 },
    { key: 'sleep_goal_hours', label: 'Sleep goal (hours)', type: 'number', min: 0, step: 0.5 },
    { key: 'calorie_goal', label: 'Calorie goal', type: 'number', min: 0 },
    { key: 'protein_goal_g', label: 'Protein goal (g)', type: 'number', min: 0 },
    { key: 'carbs_goal_g', label: 'Carbs goal (g)', type: 'number', min: 0 },
    { key: 'fat_goal_g', label: 'Fat goal (g)', type: 'number', min: 0 },
    { key: 'focus_goal_min', label: 'Focus goal (min)', type: 'number', min: 0 },
  ];

  el.innerHTML = `<div class="hl-settings-inner">
    <div class="hl-settings-head">Health Goals</div>
    <div class="hl-settings-grid">
      ${fields.map(f => `
        <div class="hl-settings-field">
          <label class="hl-settings-label">${f.label}</label>
          <input type="${f.type}" class="hl-settings-input" data-key="${f.key}"
            value="${settings[f.key]}" ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''}>
        </div>
      `).join('')}
    </div>
  </div>`;

  el.querySelectorAll('.hl-settings-input').forEach(input => {
    input.addEventListener('change', () => {
      const s = getSettings();
      s[input.dataset.key] = parseFloat(input.value) || 0;
      localStorage.setItem('health_settings', JSON.stringify(s));
      renderHealth();
    });
  });
}
```

### 4.3 — Settings toggle handler

```js
$('hlSettingsToggle').addEventListener('click', () => {
  _settingsOpen = !_settingsOpen;
  renderSettings();
  if (_settingsOpen === false) renderHealth(); // re-render to reflect settings
});
```

Call `renderSettings()` inside `renderHealth()` after snapshot.

### 4.4 — Settings CSS

**File:** `css/styles.css` — collapsible panel, grid layout, input styling. Consistent with existing form inputs (`.nt-form-input` style).

### 4.5 — Settings panel HTML placeholder

**File:** `index.html` after the snapshot section

```html
<div id="hlSettingsPanel" hidden></div>
```

---

## Batch 5: UX Polish

### 5.1 — Readiness factor breakdown

**File:** `js/health.js:186-247`

Below readiness ring, add factor bars showing each of the 7 factor scores (0-100):

```
Readiness 72%
─────────────────
Sleep        ████████████ 80%
Hydration    ████████     65%
Exercise     █████████████ 95%
Mood         ██████       50%
Nutrition    ████████████ 82%
Recovery     █████████    73%
Consistency  █████        42%
```

Reuse the factor scores already computed in `calcReadiness()`. Return the breakdown from `calcReadiness()` alongside the aggregate score.

### 5.2 — Meal editing

**File:** `js/health.js:978-1071`

- Add edit button in `.nt-meal-row` (pencil icon or "edit" text)
- `openMealModal` accepts optional `editIndex` param
- If `editIndex` is provided, pre-fill modal with existing values
- On save, replace meal at `editIndex` instead of `.push()`

### 5.3 — Custom water input

**File:** `js/health.js:311-317`

- Add `<input type="number" class="ql-water-custom" id="qlWaterCustom" min="0" placeholder="oz">` next to preset buttons
- On blur/Enter, parse value, add to `day.water_oz`, save, re-render
- Clear input after save

### 5.4 — Water goal line on bar

**File:** `css/styles.css` + `js/health.js`

- Add a small tick mark or dashed vertical line inside `.ql-water-bar` at the goal position
- Position via percentage: `(settings.water_goal_oz / maxWater) * 100%` where maxWater is a sensible upper bound (e.g., `water_goal_oz * 1.3` or use `waterPct` inverse)

---

## Batch 6: Export

### 6.1 — Export button

**File:** `index.html` — add "Export" button in date nav area or settings area

**File:** `js/health.js` — export handler

```js
function exportHealthData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('health:') || key === 'health_settings') {
      try { data[key] = JSON.parse(localStorage.getItem(key)); } catch (e) { data[key] = localStorage.getItem(key); }
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health-export-${getActiveDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 6.2 — Import

**File:** `js/health.js` — import handler via `<input type="file">`

- Parse JSON, validate shape (expects object with `health_settings` and/or `health:*` keys)
- Write each key to localStorage
- Show success/error toast
- Re-render health tab

---

## Files touched (summary)

| File | Batches |
|------|---------|
| `js/health.js` | 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 3.5, 3.6, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2 |
| `css/styles.css` | 1.3, 2.3, 2.4, 3.4, 4.4, 5.4 |
| `index.html` | 3.3, 4.1, 4.5, 5.3, 6.1 |

No new files. No external dependencies. No build step.

## Verification

Open `index.html` in browser. Test each batch:
1. Log sleep at 2AM → should save to previous day's date key
2. Toggle AM/PM in sleep picker → minutes preserved
3. Rapid-click water +8 → no data loss
4. Recovery sliders in Recovery card, Quick Log cleaner
5. Date nav arrows/picker → all sections reflect chosen date
6. Settings gear → form saves, goals reflected in snapshot/trends
7. Export → valid JSON download, can re-import
