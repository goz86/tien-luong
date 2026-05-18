import type { Expense, Shift } from './types';

const QUEUE_PREFIX = 'duhoc-mate-sync-queue';

export type SyncQueueItem =
  | { id: string; type: 'upsert_shift'; payload: Shift; createdAt: string }
  | { id: string; type: 'delete_shift'; payload: { id: string }; createdAt: string }
  | { id: string; type: 'upsert_expense'; payload: Expense; createdAt: string }
  | { id: string; type: 'delete_expense'; payload: { id: string }; createdAt: string };

function queueKey(userId: string) {
  return `${QUEUE_PREFIX}:${userId}`;
}

function readQueue(userId: string): SyncQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(queueKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(userId: string, queue: SyncQueueItem[]) {
  if (typeof window === 'undefined') return;
  if (queue.length === 0) {
    window.localStorage.removeItem(queueKey(userId));
    window.dispatchEvent(new CustomEvent('duhoc-mate-sync-queue-change', { detail: { userId } }));
    return;
  }
  window.localStorage.setItem(queueKey(userId), JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('duhoc-mate-sync-queue-change', { detail: { userId } }));
}

export function enqueueSyncItem(userId: string, item: Omit<SyncQueueItem, 'id' | 'createdAt'>) {
  const queue = readQueue(userId);
  const nextItem = {
    ...item,
    id: `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  } as SyncQueueItem;

  const compacted = queue.filter((queued) => {
    if (item.type === 'upsert_shift' && queued.type === 'upsert_shift') return queued.payload.id !== item.payload.id;
    if (item.type === 'delete_shift') return !(queued.type.includes('shift') && queued.payload.id === item.payload.id);
    if (item.type === 'upsert_expense' && queued.type === 'upsert_expense') return queued.payload.id !== item.payload.id;
    if (item.type === 'delete_expense') return !(queued.type.includes('expense') && queued.payload.id === item.payload.id);
    return true;
  });

  writeQueue(userId, [...compacted, nextItem]);
}

export function getSyncQueue(userId: string) {
  return readQueue(userId);
}

export function removeSyncQueueItem(userId: string, itemId: string) {
  writeQueue(userId, readQueue(userId).filter((item) => item.id !== itemId));
}
