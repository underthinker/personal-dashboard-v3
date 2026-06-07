// Sync engine: offline-first orchestration of push (local -> cloud), pull
// (cloud -> local, incremental), realtime, and Last-Write-Wins resolution.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, sbWrite } from '../config/supabase';
import { applyRemote, refreshUI, setCaptureEnabled, type CaptureEvent } from '../storage/local';
import {
  allMutations,
  countMutations,
  deleteMutation,
  enqueue,
  getCursor,
  getShadow,
  setCursor,
  setShadow,
  clearAll,
} from '../storage/queue';
import type { EntryRow, HabitRow, ProfileRow, SettingRow } from './db-types';
import {
  PROFILE_KEYS,
  HABIT_DEFS_KEY,
  classifyKey,
  entryLocalKey,
  habitDefsToRows,
  parseDateKey,
  payloadToValue,
  rowsToHabitDefs,
  valueToPayload,
} from './mappers';
import { isAccountMigrated, migrateLocalData } from './migration';
import type { Mutation, SyncStateEvent, SyncStatus, SyncTable } from './types';

const EPOCH = '1970-01-01T00:00:00Z';
const PERIODIC_MS = 60_000;
const MAX_BACKOFF_MS = 60_000;
const PUSH_TABLES: SyncTable[] = ['entries', 'settings', 'habits', 'profiles'];

type StateListener = (s: SyncStateEvent) => void;

export class SyncEngine {
  private userId: string | null = null;
  private online = navigator.onLine;
  private pushing = false;
  private pulling = false;
  private pushScheduled = false;
  private backoffMs = 1000;
  private lastError: string | undefined;
  private lastSyncedAt: string | undefined;
  private channels: RealtimeChannel[] = [];
  private periodic: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<StateListener>();

  private readonly onlineHandler = () => {
    this.online = true;
    void this.push();
    void this.pullAll();
    this.emit();
  };
  private readonly offlineHandler = () => {
    this.online = false;
    this.emit();
  };

  // ── lifecycle ──────────────────────────────────────────────────────────
  async start(userId: string): Promise<void> {
    if (!supabase) return;
    this.userId = userId;
    this.lastError = undefined;
    this.emit('syncing');

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    try {
      await this.pullAll(); // also fetches the migration marker if present
      if (!(await isAccountMigrated(userId))) {
        await migrateLocalData(userId);
      }
      await this.push();
    } catch (e) {
      this.lastError = errMsg(e);
    }

    setCaptureEnabled(true);
    this.setupRealtime();
    this.periodic = setInterval(() => {
      void this.push();
      void this.pullAll();
    }, PERIODIC_MS);

    refreshUI();
    this.emit();
  }

  async stop(): Promise<void> {
    setCaptureEnabled(false);
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    if (this.periodic) clearInterval(this.periodic);
    this.periodic = null;
    for (const ch of this.channels) await supabase?.removeChannel(ch);
    this.channels = [];
    await clearAll();
    this.userId = null;
    this.emit('signedout');
  }

  onState(fn: StateListener): () => void {
    this.listeners.add(fn);
    void this.emit();
    return () => this.listeners.delete(fn);
  }

  // ── capture from interceptor ─────────────────────────────────────────────
  handleCapture(e: CaptureEvent): void {
    if (!this.userId) return;
    void (async () => {
      await enqueue({ key: e.key, value: e.value, updatedAt: e.updatedAt });
      await setShadow(e.key, e.updatedAt);
      this.schedulePush();
      this.emit('syncing');
    })();
  }

  // ── push ─────────────────────────────────────────────────────────────────
  private schedulePush(): void {
    if (this.pushScheduled) return;
    this.pushScheduled = true;
    setTimeout(() => {
      this.pushScheduled = false;
      void this.push();
    }, 400);
  }

  private async push(): Promise<void> {
    if (!supabase || !this.userId || this.pushing) return;
    if (!this.online) {
      this.emit();
      return;
    }
    this.pushing = true;
    this.emit('syncing');
    try {
      let pending = await allMutations();
      while (pending.length > 0) {
        for (const m of pending) {
          await this.pushOne(m);
          if (m.id != null) await deleteMutation(m.id);
        }
        pending = await allMutations();
      }
      this.backoffMs = 1000;
      this.lastError = undefined;
      this.lastSyncedAt = new Date().toISOString();
    } catch (e) {
      this.lastError = errMsg(e);
      // Retry later with exponential backoff (capped).
      setTimeout(() => void this.push(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    } finally {
      this.pushing = false;
      this.emit();
    }
  }

  private async pushOne(m: Mutation): Promise<void> {
    if (!supabase || !this.userId) return;
    const userId = this.userId;
    const kind = classifyKey(m.key);
    const removed = m.value === null;

    if (kind === 'entry') {
      const ref = parseDateKey(m.key)!;
      const { error } = await sbWrite!.from('entries').upsert(
        {
          user_id: userId,
          entity: ref.entity,
          date_key: ref.dateKey,
          payload: removed ? null : valueToPayload(m.key, m.value!),
          deleted: removed,
          updated_at: m.updatedAt,
        },
        { onConflict: 'user_id,entity,date_key' },
      );
      if (error) throw error;
    } else if (kind === 'setting') {
      const { error } = await sbWrite!.from('settings').upsert(
        {
          user_id: userId,
          key: m.key,
          payload: removed ? null : valueToPayload(m.key, m.value!),
          deleted: removed,
          updated_at: m.updatedAt,
        },
        { onConflict: 'user_id,key' },
      );
      if (error) throw error;
    } else if (kind === 'habits') {
      await this.pushHabitDefs(userId, m.value, m.updatedAt);
    } else if (kind === 'profile-name' || kind === 'profile-avatar') {
      const patch: Partial<ProfileRow> & { id: string } = { id: userId, updated_at: m.updatedAt };
      if (kind === 'profile-name') patch.display_name = removed ? null : m.value;
      else patch.avatar = removed ? null : m.value;
      const { error } = await sbWrite!.from('profiles').upsert(patch, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  private async pushHabitDefs(userId: string, value: string | null, updatedAt: string): Promise<void> {
    if (!supabase) return;
    const rows = habitDefsToRows(value);
    const present = new Set(rows.map((r) => r.slug));
    if (rows.length > 0) {
      const { error } = await sbWrite!
        .from('habits')
        .upsert(
          rows.map((r) => ({ user_id: userId, updated_at: updatedAt, ...r })),
          { onConflict: 'user_id,slug' },
        );
      if (error) throw error;
    }
    // Tombstone any slugs that no longer exist locally.
    const { data: existing, error: selErr } = await supabase
      .from('habits')
      .select('slug')
      .eq('user_id', userId)
      .eq('deleted', false);
    if (selErr) throw selErr;
    const stale = ((existing ?? []) as Array<{ slug: string }>)
      .map((r) => r.slug)
      .filter((s) => !present.has(s));
    if (stale.length > 0) {
      const { error } = await sbWrite!
        .from('habits')
        .upsert(
          stale.map((slug) => ({ user_id: userId, slug, name: slug, deleted: true, updated_at: updatedAt })),
          { onConflict: 'user_id,slug' },
        );
      if (error) throw error;
    }
  }

  // ── pull ─────────────────────────────────────────────────────────────────
  private async pullAll(): Promise<void> {
    if (!supabase || !this.userId || this.pulling || !this.online) return;
    this.pulling = true;
    this.emit('syncing');
    try {
      let changed = false;
      for (const table of PUSH_TABLES) {
        if (await this.pullTable(table)) changed = true;
      }
      if (changed) refreshUI();
      this.lastSyncedAt = new Date().toISOString();
    } catch (e) {
      this.lastError = errMsg(e);
    } finally {
      this.pulling = false;
      this.emit();
    }
  }

  private async pullTable(table: SyncTable): Promise<boolean> {
    if (!supabase || !this.userId) return false;
    const userId = this.userId;
    const cursor = await getCursor(table);
    const ownerCol = table === 'profiles' ? 'id' : 'user_id';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(ownerCol, userId)
      .gt('updated_at', cursor.lastPulledAt || EPOCH)
      .order('updated_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as Array<EntryRow | SettingRow | HabitRow | ProfileRow>;
    if (rows.length === 0) return false;

    let changed = false;
    let maxTs = cursor.lastPulledAt || EPOCH;
    for (const row of rows) {
      if (row.updated_at > maxTs) maxTs = row.updated_at;
      if (table === 'habits') continue; // handled in bulk below
      if (await this.applyRow(table, row as EntryRow | SettingRow | ProfileRow)) changed = true;
    }
    if (table === 'habits') {
      if (await this.rebuildHabitDefs(userId, maxTs)) changed = true;
    }
    await setCursor(table, maxTs);
    return changed;
  }

  private async applyRow(table: SyncTable, row: EntryRow | SettingRow | ProfileRow): Promise<boolean> {
    if (table === 'entries') {
      const r = row as EntryRow;
      const key = entryLocalKey(r.entity, r.date_key);
      const value = r.deleted ? null : JSON.stringify(r.payload);
      return this.applyLww(key, value, r.updated_at);
    }
    if (table === 'settings') {
      const r = row as SettingRow;
      const value = r.deleted ? null : payloadToValue(r.key, r.payload);
      return this.applyLww(r.key, value, r.updated_at);
    }
    if (table === 'profiles') {
      const r = row as ProfileRow;
      let changed = false;
      if (await this.applyLww(PROFILE_KEYS.name, r.deleted ? null : r.display_name, r.updated_at)) changed = true;
      if (await this.applyLww(PROFILE_KEYS.avatar, r.deleted ? null : r.avatar, r.updated_at)) changed = true;
      return changed;
    }
    return false;
  }

  private async rebuildHabitDefs(userId: string, updatedAt: string): Promise<boolean> {
    if (!supabase) return false;
    const { data, error } = await supabase.from('habits').select('*').eq('user_id', userId);
    if (error) throw error;
    const defs = rowsToHabitDefs((data ?? []) as HabitRow[]);
    if (defs.length === 0) return false;
    return this.applyLww(HABIT_DEFS_KEY, JSON.stringify(defs), updatedAt);
  }

  /** Apply a remote value to localStorage only if it is newer than our shadow. */
  private async applyLww(key: string, value: string | null, remoteTs: string): Promise<boolean> {
    const shadow = await getShadow(key);
    if (shadow && shadow >= remoteTs) return false;
    applyRemote(key, value);
    await setShadow(key, remoteTs);
    return true;
  }

  // ── realtime ───────────────────────────────────────────────────────────
  private setupRealtime(): void {
    if (!supabase || !this.userId) return;
    const userId = this.userId;
    for (const table of PUSH_TABLES) {
      const ownerCol = table === 'profiles' ? 'id' : 'user_id';
      const ch = supabase
        .channel(`sync:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `${ownerCol}=eq.${userId}` },
          () => {
            void this.pullTableSafe(table);
          },
        )
        .subscribe();
      this.channels.push(ch);
    }
  }

  private async pullTableSafe(table: SyncTable): Promise<void> {
    if (this.pulling) return;
    this.pulling = true;
    try {
      if (await this.pullTable(table)) refreshUI();
    } catch (e) {
      this.lastError = errMsg(e);
    } finally {
      this.pulling = false;
      this.emit();
    }
  }

  // ── status ───────────────────────────────────────────────────────────────
  private async emit(force?: SyncStatus): Promise<void> {
    const pending = await countMutations().catch(() => 0);
    let status: SyncStatus;
    if (force) status = force;
    else if (!this.userId) status = 'signedout';
    else if (!this.online) status = 'offline';
    else if (this.pushing || this.pulling || pending > 0) status = 'syncing';
    else if (this.lastError) status = 'error';
    else status = 'synced';
    const evt: SyncStateEvent = {
      status,
      pending,
      ...(this.lastError ? { lastError: this.lastError } : {}),
      ...(this.lastSyncedAt ? { lastSyncedAt: this.lastSyncedAt } : {}),
    };
    for (const fn of this.listeners) fn(evt);
  }
}

function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Sync error';
}

export const engine = new SyncEngine();
