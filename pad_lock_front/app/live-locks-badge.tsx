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

function recordFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

function booleanValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "online", "connected", "active"].includes(normalized)) return true;
      if (["false", "offline", "disconnected", "inactive"].includes(normalized)) return false;
    }
  }

  return undefined;
}

function isOnlinePadLock(value: unknown) {
  const record = recordFrom(value);
  if (!record) return false;

  const status = textValue(record.status, record.connectionStatus, record.state)?.toLowerCase();
  const nested = nestedRecord(record, ["position", "telemetry", "lock", "device"]);
  const nestedStatus = nested ? textValue(nested.status, nested.connectionStatus, nested.state)?.toLowerCase() : undefined;
  const online = booleanValue(
    record.online,
    record.connected,
    record.telemetryAvailable,
    record.isOnline,
    nested?.online,
    nested?.connected,
    nested?.telemetryAvailable,
    nested?.isOnline,
  );

  if (online !== undefined) return online;

  return status === "online" || status === "connected" || nestedStatus === "online" || nestedStatus === "connected";
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
      const payload = await cachedApiJson("/devices", true);
      sharedCount = rowsFromPayload(payload).filter(isOnlinePadLock).length;
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
