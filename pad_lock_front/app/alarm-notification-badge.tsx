"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildAlertStreamUrl, cachedApiJson, getStoredAccessToken } from "../lib/api";

function rowsFromPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.results)) return record.results;
    if (Array.isArray(record.alerts)) return record.alerts;
  }

  return [];
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return String(value);
  }

  return undefined;
}

function alertIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;

  const record = payload as Record<string, unknown>;
  const timestamp = textValue(record.timestamp, record.createdAt, record.occurredAt, record.time);

  const fallbackId = [
    textValue(record.terminalId, record.deviceId, record.lockId),
    textValue(record.type, record.eventType, record.alarmType, record.kind),
    timestamp,
  ]
    .filter(Boolean)
    .join("-");

  const primaryId = textValue(record.id, record.uuid, record.eventId);

  return primaryId ?? (fallbackId || undefined);
}

const ALARMS_VIEWED_AT_KEY = "pad_lock_alarms_viewed_at";

function alarmTimestamp(row: unknown) {
  if (!row || typeof row !== "object") return 0;
  const record = row as Record<string, unknown>;
  const raw = textValue(record.timestamp, record.createdAt, record.occurredAt, record.time, record.date);
  const value = raw ? Date.parse(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function lastViewedAt() {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(ALARMS_VIEWED_AT_KEY) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function markAlarmsViewed() {
  window.localStorage.setItem(ALARMS_VIEWED_AT_KEY, String(Date.now()));
}

function isUnreadNotification(row: unknown) {
  if (!row || typeof row !== "object") return false;

  const record = row as Record<string, unknown>;
  const status = textValue(record.status, record.readStatus)?.toLowerCase();
  const resolved = textValue(record.resolved)?.toLowerCase();
  const read = textValue(record.read, record.isRead)?.toLowerCase();

  if (status?.includes("resolved") || status === "read") return false;
  if (resolved === "true" || read === "true") return false;

  return true;
}


function parseStreamMessage(message: string) {
  const lines = message.split(/\r?\n/);
  const eventName = lines
    .find((line) => line.startsWith("event: "))
    ?.slice(7)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .join("\n");

  return { eventName, data };
}

export function AlarmNotificationBadge() {
  const pathname = usePathname();
  const suppressNotifications = pathname === "/alarms";
  const [count, setCount] = useState(0);
  const seenAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: number | null = null;
    const abortController = new AbortController();

    async function loadInitialCount() {
      if (suppressNotifications) {
        seenAlertIds.current.clear();
        setCount(0);
        return;
      }

      try {
        const payload = await cachedApiJson("/alerts", true);

        if (isMounted) {
          const viewedAt = lastViewedAt();
          const rows = rowsFromPayload(payload).filter((row) => isUnreadNotification(row) && alarmTimestamp(row) > viewedAt);
          seenAlertIds.current = new Set(
            rows.map(alertIdFromPayload).filter((id): id is string => Boolean(id)),
          );
          setCount(rows.length);
        }
      } catch {
        if (isMounted) {
          setCount(0);
        }
      }
    }

    function resetNotifications() {
      markAlarmsViewed();
      seenAlertIds.current.clear();
      setCount(0);
    }

    function addLiveAlert(payload: unknown) {
      if (suppressNotifications || !isUnreadNotification(payload)) return;

      const incomingId = alertIdFromPayload(payload);

      if (incomingId && seenAlertIds.current.has(incomingId)) return;
      if (incomingId) seenAlertIds.current.add(incomingId);

      setCount((currentCount) => currentCount + 1);
    }

    async function waitBeforeReconnect() {
      await new Promise<void>((resolve) => {
        reconnectTimeout = window.setTimeout(resolve, 1500);
      });
    }

    async function openStream() {
      await Promise.resolve();

      while (isMounted && !abortController.signal.aborted) {
        const token = getStoredAccessToken();

        if (!token) return;

        try {
          const response = await fetch(buildAlertStreamUrl(), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: abortController.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error("Impossible de recevoir les alertes en temps reel");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (isMounted && !abortController.signal.aborted) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split(/\r?\n\r?\n/);
            buffer = messages.pop() ?? "";

            for (const message of messages) {
              const { eventName, data } = parseStreamMessage(message);

              if (eventName === "alert" && data) {
                try {
                  addLiveAlert(JSON.parse(data));
                } catch {
                  // Ignore malformed live events; the next valid alert will still update the badge.
                }
              }
            }
          }
        } catch {
          if (!isMounted || abortController.signal.aborted) return;
        }

        if (isMounted && !abortController.signal.aborted) {
          await waitBeforeReconnect();
        }
      }
    }

    window.addEventListener("pad-lock:alarms-viewed", resetNotifications);
    loadInitialCount();
    openStream();

    return () => {
      isMounted = false;
      abortController.abort();
      window.removeEventListener("pad-lock:alarms-viewed", resetNotifications);

      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }
    };
  }, [suppressNotifications]);
  return <>{count > 99 ? "99+" : count}</>;
}