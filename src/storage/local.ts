// Non-invasive capture of writes to the synchronous localStorage cache that the
// legacy vanilla modules use. We monkey-patch setItem/removeItem once; tracked
// keys are reported to the engine for queuing. Remote-applied writes go through
// applyRemote() which bypasses capture and refreshes the UI.
import { isTrackedKey } from '../sync/mappers';

export interface CaptureEvent {
  key: string;
  value: string | null; // null == removed (tombstone)
  updatedAt: string; // ISO
}

type CaptureFn = (e: CaptureEvent) => void;

const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;

let captureEnabled = false;
let applyingRemote = false;
let onCapture: CaptureFn | null = null;
let installed = false;

export function installInterceptor(handler: CaptureFn): void {
  onCapture = handler;
  if (installed) return;
  installed = true;

  Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
    nativeSetItem.call(this, key, value);
    if (this === window.localStorage && captureEnabled && !applyingRemote && isTrackedKey(key)) {
      onCapture?.({ key, value, updatedAt: new Date().toISOString() });
    }
  };

  Storage.prototype.removeItem = function (this: Storage, key: string): void {
    nativeRemoveItem.call(this, key);
    if (this === window.localStorage && captureEnabled && !applyingRemote && isTrackedKey(key)) {
      onCapture?.({ key, value: null, updatedAt: new Date().toISOString() });
    }
  };
}

export function setCaptureEnabled(on: boolean): void {
  captureEnabled = on;
}

/** Write a value that originated from the cloud — never re-queued. */
export function applyRemote(key: string, value: string | null): void {
  applyingRemote = true;
  try {
    if (value === null) nativeRemoveItem.call(window.localStorage, key);
    else nativeSetItem.call(window.localStorage, key, value);
  } finally {
    applyingRemote = false;
  }
}

export function readLocal(key: string): string | null {
  return window.localStorage.getItem(key);
}

// ── UI refresh after remote applies ─────────────────────────────────────────
const RENDER_FNS = [
  'renderGoals',
  'renderHabits',
  'renderHabitFullRings',
  'renderHealth',
  'renderHomeHealthRings',
  'renderHomeMood',
  'renderHomeInsights',
  'renderCalendar',
  'renderTimeline',
  'renderWeather',
  'renderStatsPanel',
  'renderSidebarAtAGlance',
  'updateGreeting',
  'updateHomeBadge',
] as const;

let refreshScheduled = false;

/** Debounced, idempotent re-render of all widgets (they re-read localStorage). */
export function refreshUI(): void {
  if (refreshScheduled) return;
  refreshScheduled = true;
  requestAnimationFrame(() => {
    refreshScheduled = false;
    const w = window as unknown as Record<string, unknown>;
    for (const name of RENDER_FNS) {
      const fn = w[name];
      if (typeof fn === 'function') {
        try {
          (fn as () => void)();
        } catch {
          /* a single widget failing must not block the others */
        }
      }
    }
    // Legacy listeners (goals/accent/etc.) may still be wired up.
    window.dispatchEvent(new CustomEvent('goals-changed'));
    window.dispatchEvent(new CustomEvent('accent-changed'));
  });
}
