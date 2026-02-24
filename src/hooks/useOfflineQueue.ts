import { useEffect, useState, useCallback } from "react";
import type { QueuedDatapoint } from "../types.ts";
import { OFFLINE_QUEUE_KEY } from "../constants.ts";
import { postBeeminderDatapoint, NetworkError } from "../utils.ts";

function loadQueue(): QueuedDatapoint[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (raw) return JSON.parse(raw) as QueuedDatapoint[];
  } catch {
    // ignore
  }
  return [];
}

function saveQueue(queue: QueuedDatapoint[]) {
  if (queue.length === 0) {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } else {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }
}

export function useOfflineQueue(username: string, authToken: string) {
  const [queue, setQueue] = useState<QueuedDatapoint[]>(loadQueue);

  const enqueue = useCallback((item: QueuedDatapoint) => {
    setQueue((prev) => {
      const next = [...prev, item];
      saveQueue(next);
      return next;
    });
  }, []);

  const processQueue = useCallback(async () => {
    const current = loadQueue();
    if (current.length === 0 || !username || !authToken) return;

    const remaining: QueuedDatapoint[] = [];

    for (const item of current) {
      try {
        await postBeeminderDatapoint(
          username,
          authToken,
          item.goalSlug,
          item.value,
          item.comment,
          item.timestamp,
        );
        // Success — item is not added to remaining
      } catch (e) {
        if (e instanceof NetworkError) {
          // Still offline — keep this and all subsequent items
          remaining.push(...current.slice(current.indexOf(item)));
          break;
        }
        // API error — drop the item (it won't ever succeed)
        console.error("Dropping queued datapoint due to API error:", item, e);
      }
    }

    setQueue(remaining);
    saveQueue(remaining);
  }, [username, authToken]);

  // Process queue when coming online (and on mount if already online)
  useEffect(() => {
    const handler = () => {
      processQueue();
    };
    window.addEventListener("online", handler);
    // Process on mount if currently online — scheduled to avoid synchronous setState in effect
    if (navigator.onLine) {
      queueMicrotask(handler);
    }
    return () => window.removeEventListener("online", handler);
  }, [processQueue]);

  return { queue, enqueue, processQueue };
}
