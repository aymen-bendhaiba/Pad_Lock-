"use client";

import { useEffect, useState } from "react";
import { cachedApiJson } from "../lib/api";

function rowsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "items", "results", "devices", "locks", "rows"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

let sharedCount: number | null = null;
let sharedTimer: number | null = null;
let sharedRequest: Promise<void> | null = null;
const subscribers = new Set<(count: number | null) => void>();

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber(sharedCount));
}

async function loadSharedLocksCount() {
  if (sharedRequest) return sharedRequest;

  sharedRequest = (async () => {
    try {
      const payload = await cachedApiJson("/locks", true);
      sharedCount = rowsFromPayload(payload).length;
    } catch {
      sharedCount = null;
    } finally {
      notifySubscribers();
      sharedRequest = null;
    }
  })();

  return sharedRequest;
}

function subscribeToLocksCount(subscriber: (count: number | null) => void) {
  subscribers.add(subscriber);
  subscriber(sharedCount);
  void loadSharedLocksCount();

  if (!sharedTimer) {
    sharedTimer = window.setInterval(() => {
      void loadSharedLocksCount();
    }, 30000);
  }

  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size && sharedTimer) {
      window.clearInterval(sharedTimer);
      sharedTimer = null;
    }
  };
}

export function LiveLocksBadge({ compact = false }: { compact?: boolean }) {
  const [count, setCount] = useState<number | null>(sharedCount);

  useEffect(() => subscribeToLocksCount(setCount), []);

  if (compact) return <>{count === null ? "--" : count}</>;

  return (
    <>
      <span className="mr-1.5 size-2 rounded-full bg-[#34C759]" />
      {count === null ? "-- PadLock" : count + " PadLock"}
    </>
  );
}
