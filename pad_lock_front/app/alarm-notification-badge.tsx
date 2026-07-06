"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cachedApiJson } from "../lib/api";

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
  ].filter(Boolean).join("-");

  return textValue(record.id, record.uuid, record.eventId) ?? (fallbackId || undefined);
}

const ALARMS_VIEWED_AT_KEY = "pad_lock_alarms_viewed_at";
const ALERT_RECEIVED_EVENT = "pad-lock:alert-received";

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

export function AlarmNotificationBadge() {
  const pathname = usePathname();
  const suppressNotifications = pathname === "/alarms";
  const [count, setCount] = useState(0);
  const seenAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

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
          seenAlertIds.current = new Set(rows.map(alertIdFromPayload).filter((id): id is string => Boolean(id)));
          setCount(rows.length);
        }
      } catch {
        if (isMounted) setCount(0);
      }
    }

    function resetNotifications() {
      markAlarmsViewed();
      seenAlertIds.current.clear();
      setCount(0);
    }

    function addLiveAlert(event: Event) {
      const payload = event instanceof CustomEvent ? event.detail : undefined;
      if (suppressNotifications || !isUnreadNotification(payload)) return;

      const incomingId = alertIdFromPayload(payload);
      if (incomingId && seenAlertIds.current.has(incomingId)) return;
      if (incomingId) seenAlertIds.current.add(incomingId);

      setCount((currentCount) => currentCount + 1);
    }

    window.addEventListener("pad-lock:alarms-viewed", resetNotifications);
    window.addEventListener(ALERT_RECEIVED_EVENT, addLiveAlert);
    void loadInitialCount();

    return () => {
      isMounted = false;
      window.removeEventListener("pad-lock:alarms-viewed", resetNotifications);
      window.removeEventListener(ALERT_RECEIVED_EVENT, addLiveAlert);
    };
  }, [suppressNotifications]);

  return <>{count > 99 ? "99+" : count}</>;
}
