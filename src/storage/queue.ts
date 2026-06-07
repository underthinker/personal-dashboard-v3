// Durable sync state in IndexedDB: the pending mutation queue, per-table pull
// cursors, LWW shadow timestamps, and small meta flags. Async by nature, which
// is why it lives here and not in the synchronous localStorage cache.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Cursor, Mutation, SyncTable } from '../sync/types';

interface SyncDB extends DBSchema {
  mutations: {
    key: number;
    value: Mutation;
  };
  meta: {
    key: string;
    value: { k: string; v: string };
  };
}

const DB_NAME = 'ikigai-sync';
const DB_VERSION = 1;

let dbp: Promise<IDBPDatabase<SyncDB>> | null = null;

function db(): Promise<IDBPDatabase<SyncDB>> {
  if (!dbp) {
    dbp = openDB<SyncDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('mutations')) {
          d.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('meta')) {
          d.createObjectStore('meta', { keyPath: 'k' });
        }
      },
    });
  }
  return dbp;
}

// ── mutation queue ─────────────────────────────────────────────────────────
export async function enqueue(m: Mutation): Promise<void> {
  const d = await db();
  // Collapse: drop any existing pending mutation for the same key so we only
  // ever push the latest value (LWW also holds at the destination).
  const tx = d.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');
  let cursor = await store.openCursor();
  while (cursor) {
    if (cursor.value.key === m.key) await cursor.delete();
    cursor = await cursor.continue();
  }
  await store.add(m);
  await tx.done;
}

export async function allMutations(): Promise<Mutation[]> {
  return (await db()).getAll('mutations');
}

export async function deleteMutation(id: number): Promise<void> {
  await (await db()).delete('mutations', id);
}

export async function countMutations(): Promise<number> {
  return (await db()).count('mutations');
}

// ── meta (cursors / shadows / flags) ───────────────────────────────────────
async function metaGet(k: string): Promise<string | null> {
  const row = await (await db()).get('meta', k);
  return row ? row.v : null;
}

async function metaSet(k: string, v: string): Promise<void> {
  await (await db()).put('meta', { k, v });
}

export async function getCursor(table: SyncTable): Promise<Cursor> {
  const v = await metaGet(`cursor:${table}`);
  return { table, lastPulledAt: v ?? '' };
}

export async function setCursor(table: SyncTable, lastPulledAt: string): Promise<void> {
  await metaSet(`cursor:${table}`, lastPulledAt);
}

export async function getShadow(localKey: string): Promise<string | null> {
  return metaGet(`shadow:${localKey}`);
}

export async function setShadow(localKey: string, updatedAt: string): Promise<void> {
  await metaSet(`shadow:${localKey}`, updatedAt);
}

export async function getFlag(name: string): Promise<string | null> {
  return metaGet(`flag:${name}`);
}

export async function setFlag(name: string, value: string): Promise<void> {
  await metaSet(`flag:${name}`, value);
}

/** Wipe all sync state (on logout / account switch). App data in localStorage is untouched. */
export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['mutations', 'meta'], 'readwrite');
  await tx.objectStore('mutations').clear();
  await tx.objectStore('meta').clear();
  await tx.done;
}
