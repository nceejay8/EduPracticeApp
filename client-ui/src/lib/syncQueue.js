/**
 * A durable outbox for local-first writes.
 *
 * The problem this solves: an attempt completed with no network was written to
 * localStorage and then pushed to Supabase with a bare `.catch(console.warn)`.
 * Nothing ever retried, so when the network came back the server copy was still
 * missing that attempt — and because the read path preferred the server copy,
 * the attempt vanished from every analytics view while remaining on disk.
 *
 * So writes go through here instead. `enqueueSync` records the intent
 * durably, and `flushSync` drains it whenever the network is back. The queue is
 * the record of what still owes the server a write, which means it has to
 * survive a reload — hence localStorage rather than a module-level array.
 *
 * Every function degrades rather than throws: blocking storage must not stop a
 * student answering questions, and a failed write must not break the page.
 */

const QUEUE_KEY = 'edupractice_sync_queue';

// Give up after this many failed attempts. A row that cannot be written (the
// table was never migrated, say) must not sit in the queue forever, growing it
// without limit and retrying on every focus.
const MAX_ATTEMPTS = 8;

function readQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(i => i && i.id && i.table) : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

// A record the queue is willing to store. Validated on read as well as on write
// so a hand-edited or truncated queue cannot inject junk into a flush.
function isValid(item) {
  return !!(item && typeof item.id === 'string' && item.id && typeof item.table === 'string' && item.table);
}

/**
 * Record a write that still has to reach the server.
 *
 * Idempotent on `id`: queueing the same attempt twice (a re-render, a second
 * effect run, a retried submit) is a no-op, so a duplicate row can never reach
 * the database.
 *
 * @returns {boolean} true if newly queued, false if already queued or storage refused.
 */
export function enqueueSync({ id, table, row }) {
  if (!isValid({ id, table })) return false;
  const items = readQueue();
  if (items.some(i => i.id === id)) return false;
  items.push({
    id,
    table,
    row,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  return writeQueue(items);
}

/** Everything still owing the server a write, oldest first. */
export function pendingSync() {
  return readQueue().sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)));
}

export function pendingCount() {
  return readQueue().length;
}

export function clearSync(id) {
  const items = readQueue();
  const next = items.filter(i => i.id !== id);
  if (next.length === items.length) return false;
  return writeQueue(next);
}

function markAttempted(id) {
  const items = readQueue();
  const next = items.map(i => (i.id === id ? { ...i, attempts: (i.attempts || 0) + 1 } : i));
  writeQueue(next);
}

/**
 * Drain the queue.
 *
 * `send` receives one item and resolves truthy when the server has accepted the
 * write. Anything else is a failure: the item stays queued and is retried on the
 * next flush. A rejected item is retried up to MAX_ATTEMPTS times and then
 * dropped, because an item that can never succeed (missing table, revoked
 * insert policy) should not block the ones behind it.
 *
 * Flushing stops early once the network looks gone, so a long queue does not
 * spin through every retry against a dead connection.
 *
 * @returns {Promise<{synced: number, failed: number, dropped: number, aborted: boolean}>}
 */
export async function flushSync(send, { limit = 25, isOnline = () => true } = {}) {
  const summary = { synced: 0, failed: 0, dropped: 0, aborted: false };
  let items = pendingSync().slice(0, limit);

  for (const item of items) {
    if (!isOnline()) {
      summary.aborted = true;
      break;
    }
    let ok = false;
    try {
      ok = await send(item);
    } catch (err) {
      ok = false;
    }
    if (ok) {
      clearSync(item.id);
      summary.synced += 1;
      continue;
    }
    markAttempted(item.id);
    const current = readQueue().find(i => i.id === item.id);
    if (current && (current.attempts || 0) >= MAX_ATTEMPTS) {
      clearSync(item.id);
      summary.dropped += 1;
      console.warn(
        `Sync queue: giving up on ${item.table}/${item.id} after ${current.attempts} attempts.`,
        'Check the table exists and that the signed-in user is allowed to insert into it.'
      );
    } else {
      summary.failed += 1;
    }
  }

  items = null;
  return summary;
}

/** Test/debug helper. */
export function resetSyncQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* nothing to clear */
  }
}
