/**
 * Offline sync queue.
 * When the app is offline, mutations (create/update/delete) are stored
 * locally and replayed in order when connectivity returns.
 * Each queued op carries enough info to re-run against the Base44 SDK.
 */
import { base44 } from '@/api/base44Client';
import { invalidateEntity } from './cache';
import { getCachedUserId, userStorageKey } from './currentUser';

const queueKey = (userId = getCachedUserId()) => userStorageKey('sync-queue', userId);

function readQueue(userId = getCachedUserId()) {
  try {
    const storageKey = queueKey(userId);
    if (!storageKey) return [];
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(q, userId = getCachedUserId()) {
  const storageKey = queueKey(userId);
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent('cedar-sync-queue-changed'));
}

export function enqueueOperation(op) {
  const userId = getCachedUserId();
  if (!userId) throw new Error('Cannot queue a change before authentication is known');
  const q = readQueue(userId);
  q.push({ ...op, ownerUserId: userId, queuedAt: Date.now() });
  writeQueue(q, userId);
}

export function getQueueLength() {
  return readQueue().length;
}

export function removeFromQueue(index) {
  const q = readQueue();
  q.splice(index, 1);
  writeQueue(q);
}

async function runOp(op, userId) {
  if (!userId || op.ownerUserId !== userId) {
    throw new Error('Queued operation owner does not match the signed-in user');
  }
  const { entity, operation, args } = op;
  const e = base44.entities[entity];
  if (!e) throw new Error(`Unknown entity: ${entity}`);
  switch (operation) {
    case 'create': return await e.create(...args);
    case 'update': return await e.update(...args);
    case 'delete': return await e.delete(...args);
    case 'bulkCreate': return await e.bulkCreate(...args);
    case 'updateMany': return await e.updateMany(...args);
    case 'deleteMany': return await e.deleteMany(...args);
    default: throw new Error(`Unsupported operation: ${operation}`);
  }
}

/**
 * Replay all queued operations in order.
 * Returns { succeeded, failed }.
 */
export async function replayQueue() {
  const userId = getCachedUserId();
  if (!userId) return { succeeded: 0, failed: 0 };
  const q = readQueue(userId);
  if (q.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  const remaining = [];

  for (let i = 0; i < q.length; i++) {
    const op = q[i];
    // Never retain or replay an operation found under the wrong user's key.
    if (op?.ownerUserId !== userId) {
      failed++;
      continue;
    }
    try {
      await runOp(op, userId);
      invalidateEntity(op.entity);
      succeeded++;
    } catch {
      // Keep same-owner failures for the next attempt.
      remaining.push(op);
      failed++;
    }
  }

  writeQueue(remaining, userId);
  return { succeeded, failed };
}

/** Whether the sync queue has pending operations. */
export function hasPending() {
  return readQueue().length > 0;
}