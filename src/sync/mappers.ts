// Single source of truth for translating between localStorage keys and
// Supabase table rows. The engine uses these helpers so the mapping lives in
// exactly one place.
import type { EntryEntity, Json } from './db-types';

export const HABIT_DEFS_KEY = 'habit_definitions';

export const PROFILE_KEYS = {
  name: 'sidebar_user_name_v1',
  avatar: 'sidebar_user_avatar_v1',
} as const;

/** Settings keys whose localStorage value is a bare string, NOT JSON-encoded. */
export const RAW_STRING_KEYS = new Set<string>(['tweak_theme', 'tweak_accent', 'active_tab', 'home_macro_slot_v1']);

/** Singleton keys synced to the `settings` table. */
export const SETTINGS_KEYS = new Set<string>([
  'health_settings',
  'timeline_blocks_v2',
  'recurring_blocks_v1',
  'schedule_templates_v1',
  'day_ring_blocks_v1',
  'weather_config_v1',
  'goal_streak_v1',
  'goal_rollover_v1',
  'focus_session_v1',
  'tweak_theme',
  'tweak_accent',
  'active_tab',
  'home_macro_slot_v1',
]);

const DATE_ENTITY: Record<string, EntryEntity> = {
  goals: 'goals',
  habits: 'habit_entries',
  health: 'health',
  mood: 'mood',
};
// Reverse: entity -> localStorage prefix
const ENTITY_PREFIX: Record<EntryEntity, string> = {
  goals: 'goals',
  habit_entries: 'habits',
  health: 'health',
  mood: 'mood',
};

const DATE_RE = /^(goals|habits|health|mood):(\d{4}-\d{2}-\d{2})$/;

export interface DateRef {
  entity: EntryEntity;
  dateKey: string;
}

export function parseDateKey(key: string): DateRef | null {
  const m = DATE_RE.exec(key);
  if (!m) return null;
  return { entity: DATE_ENTITY[m[1]], dateKey: m[2] };
}

export function entryLocalKey(entity: EntryEntity, dateKey: string): string {
  return `${ENTITY_PREFIX[entity]}:${dateKey}`;
}

export type TrackKind = 'entry' | 'setting' | 'habits' | 'profile-name' | 'profile-avatar';

export function classifyKey(key: string): TrackKind | null {
  if (parseDateKey(key)) return 'entry';
  if (key === HABIT_DEFS_KEY) return 'habits';
  if (key === PROFILE_KEYS.name) return 'profile-name';
  if (key === PROFILE_KEYS.avatar) return 'profile-avatar';
  if (SETTINGS_KEYS.has(key)) return 'setting';
  return null;
}

export function isTrackedKey(key: string): boolean {
  return classifyKey(key) !== null;
}

/** All currently-present tracked keys in localStorage (used by migration). */
export function listTrackedLocalKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isTrackedKey(k)) out.push(k);
  }
  return out;
}

// ── value <-> payload serialization ──────────────────────────────────────
/** Convert a raw localStorage string into a JSONB payload value. */
export function valueToPayload(key: string, value: string): Json {
  if (RAW_STRING_KEYS.has(key)) return value;
  try {
    return JSON.parse(value) as Json;
  } catch {
    return value; // tolerate non-JSON legacy values
  }
}

/** Convert a JSONB payload back into the exact localStorage string form. */
export function payloadToValue(key: string, payload: Json): string {
  if (RAW_STRING_KEYS.has(key)) return typeof payload === 'string' ? payload : String(payload);
  return JSON.stringify(payload);
}

// ── habit definition <-> habit rows ───────────────────────────────────────
export interface HabitDef {
  id: string;
  name: string;
  icon?: string;
  active?: boolean;
  [k: string]: unknown;
}

export interface HabitRowUpsert {
  slug: string;
  name: string;
  icon: string | null;
  active: boolean;
  sort: number;
  deleted: boolean;
}

export function habitDefsToRows(value: string | null): HabitRowUpsert[] {
  if (value == null) return [];
  let defs: HabitDef[];
  try {
    defs = JSON.parse(value) as HabitDef[];
  } catch {
    return [];
  }
  if (!Array.isArray(defs)) return [];
  return defs.map((d, i) => ({
    slug: String(d.id),
    name: String(d.name ?? d.id),
    icon: d.icon != null ? String(d.icon) : null,
    active: d.active !== false,
    sort: i,
    deleted: false,
  }));
}

export function rowsToHabitDefs(
  rows: Array<{ slug: string; name: string; icon: string | null; active: boolean; sort: number; deleted: boolean }>,
): HabitDef[] {
  return rows
    .filter((r) => !r.deleted)
    .sort((a, b) => a.sort - b.sort)
    .map((r) => ({ id: r.slug, name: r.name, icon: r.icon ?? 'circle', active: r.active }));
}
