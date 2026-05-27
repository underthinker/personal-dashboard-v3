# Dashboard Tab Cohesion — Full Cleanup Plan

**Created:** 2026-05-27  
**Scope:** CSS variable unification, dead code removal, gym tab → placeholder, JS cleanup  
**Standard:** Home tab's CSS variable system (`--surface`/`--line`/`--text`)

---

## Phase 1: CSS Variable System Unification

**File:** `css/styles.css`

### Remove legacy variable block (lines 38-86)
- `--bg-deep`, `--bg-surface`, `--bg-elevated`, `--bg-card`, `--bg-card-hover`
- `--border-subtle`, `--border-card`, `--border-card-hover`
- `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`
- `--accent-green`, `--accent-gold`, `--accent-amber`, `--accent-pink`, `--accent-coral`, `--accent-purple`, `--accent-blue`
- `--danger-legacy`, `--success-legacy`
- `--card-bg`, `--hairline`
- Duplicate `--radius-sm`, `--radius-md`, `--radius-lg`

### Add missing utility variables to root (needed by refactored CSS blocks)
- `--shadow-sm: 0 2px 8px rgba(0,0,0,0.3);`
- `--shadow-md: 0 8px 32px rgba(0,0,0,0.4);`
- `--shadow-lg: 0 16px 48px rgba(0,0,0,0.55);`
- `--shadow-card: 0 4px 24px rgba(0,0,0,0.3);`
- `--shadow-card-hover: 0 8px 40px rgba(0,0,0,0.45);`
- `--radius-xl: 16px;`
- `--radius-full: 999px;`
- `--ease-out`, `--ease-bounce`, `--ease-smooth`, `--ease-in-out`
- `--dur-fast: 0.12s;`, `--dur-normal: 0.2s;`, `--dur-slow: 0.35s;`
- `--warning: #f59e0b;`

---

## Phase 2: Remove Dead CSS Blocks

**File:** `css/styles.css`

Remove these duplicate/overridden blocks (refactored versions completely replace them):
- **Old Finance CSS:** lines 1402-1765
- **Old Habits CSS:** lines 1766-2027
- **Old Gym CSS:** lines 2079-2467

---

## Phase 3: Replace Legacy Variable Names in Refactored CSS

**File:** `css/styles.css`

Replace ~397 occurrences across these blocks:
- New Finance CSS (lines 2583-4449)
- Savings Charts (lines 4094-4449)
- Goal Tracker (lines 5759-6768)
- Mood Tracker (lines 6769-7260)

| Legacy | Home Tab System |
|--------|----------------|
| `--card-bg` / `--bg-card` | `--surface` |
| `--hairline` / `--border-subtle` | `--line` |
| `--text-primary` | `--text` |
| `--text-secondary` | `--muted` |
| `--text-tertiary` / `--text-muted` | `--muted-2` |
| `--radius-lg` | `--r` |
| `--radius-sm` | `--r-sm` |

---

## Phase 4: Gym Tab → Placeholder

### CSS — Remove gym CSS block (lines 4450-5758)

### HTML — Replace `#tab-gym` content (index.html lines 588-996)
```html
<div class="tab-content" id="tab-gym">
  <div style="display:flex;align-items:center;justify-content:center;height:60vh;color:var(--muted-2);font-size:18px;">
    Work in progress!
  </div>
</div>
```

### JS — Replace `js/gym.js` entire content
```js
(function() {
  window.renderGym = function() {};
})();
```

---

## Phase 5: JS Code Cleanup

### `js/finances.js`
- Remove dead `tagClass()` function (lines 78-87)
- Replace `gtEscape()` (line 1459) and its 6 usages with `window.escHtml`
  - Usage sites: lines 1478, 1492, 1528, 1585, 1668

### `js/health.js`
- Remove duplicate `getActiveDate()` at lines 23-26 (keep the one at lines 67-70)
- Replace hardcoded hex colors in template strings with CSS variable references:
  - `'#5fd687'` → `var(--success, #5fd687)`
  - `'#ff6b6b'` → `var(--danger, #ff6b6b)`
  - `'#F2C063'` → `var(--amber, #F2C063)`
  - `'#6BE3A4'` → `var(--success, #6BE3A4)`
  - keep others without CSS variable equivalents as-is

### `js/gym.js` line 522 inline style
- Replace `var(--text-tertiary)` with `var(--muted-2)`
  (Remove this when gym is gutted in Phase 4 anyway)

---

## Phase 6: Verification

- Open `index.html` in browser
- Navigate each tab: Home, Finances (Overview/Goals/Data), Habits (Tracker/Mood/Activity), Health
- Verify no console errors, consistent card styling, smooth rendering
- Verify gym tab shows "Work in progress!"
- Verify accent color changes propagate correctly across all tabs

---

## Estimated Stats

| Metric | Count |
|--------|-------|
| CSS lines removed (variables + dead blocks + gym) | ~3600 |
| CSS variable replacements | ~400 |
| JS lines removed (dead code) | ~2200 |
| Files changed | 5 (`styles.css`, `index.html`, `gym.js`, `finances.js`, `health.js`) |
