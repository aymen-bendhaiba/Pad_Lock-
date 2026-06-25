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

export function LiveLocksBadge({ compact = false }: { compact?: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLocks() {
      try {
        const payload = await cachedApiJson("/locks", true);
        if (isMounted) setCount(rowsFromPayload(payload).length);
      } catch {
        if (isMounted) setCount(null);
      }
    }

    void loadLocks();
    const timer = window.setInterval(loadLocks, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (compact) return <>{count === null ? "--" : count}</>;

  return (
    <>
      <span className="mr-1.5 size-2 rounded-full bg-[#34C759]" />
      {count === null ? "-- Locks" : count + " Locks"}
    </>
  );
}
