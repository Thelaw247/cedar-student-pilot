/**
 * Offline sync queue.
 * When the app is offline, mutations (create/update/delete) are stored
 * locally and replayed in order when connectivity returns.
 * Each queued op carries enough info to re-run against the Base44 SDK.
 */
import { base44 } from '@/api/base44Client';
import { invalidateEntity } from './cache';

const QUEUE_KEY = 'cedar-sync-queue';

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent('cedar-sync-queue-changed'));
}

export function enqueueOperation(op) {
  const q = readQueue();
  q.push({ ...op, queuedAt: Date.now() });
  writeQueue(q);
}

export function getQueueLength() {
  return readQueue().length;
}

export function removeFromQueue(index) {
  const q = readQueue();
  q.splice(index, 1);
  writeQueue(q);
}

async function runOp(op) {
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
  const q = readQueue();
  if (q.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  const remaining = [];

  for (let i = 0; i < q.length; i++) {
    const op = q[i];
    try {
      await runOp(op);
      invalidateEntity(op.entity);
      succeeded++;
    } catch {
      // Keep failed ops in the queue for next attempt
      remaining.push(op);
      failed++;
    }
  }

  writeQueue(remaining);
  return { succeeded, failed };
}

/** Whether the sync queue has pending operations. */
export function hasPending() {
  return readQueue().length > 0;
}