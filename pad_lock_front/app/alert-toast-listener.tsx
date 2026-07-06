"use client";

import { BellRing, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildAlertStreamUrl, getStoredAccessToken } from "../lib/api";

type AlertToast = {
  id: string;
  title: string;
  message: string;
  severity: string;
  device: string;
};

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return String(value);
  }

  return undefined;
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

  return textValue(record.id, record.uuid, record.eventId) ?? fallbackId;
}

function toastFromAlert(payload: unknown): AlertToast | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const lock = record.lock && typeof record.lock === "object" ? record.lock as Record<string, unknown> : undefined;
  const device = record.device && typeof record.device === "object" ? record.device as Record<string, unknown> : undefined;
  const type = textValue(record.type, record.eventType, record.alarmType, record.kind) ?? "New alert";
  const severity = textValue(record.severity, record.level, record.priority) ?? "Alert";
  const terminalId = textValue(
    record.terminalId,
    record.deviceId,
    record.lockId,
    device?.terminalId,
    device?.id,
    lock?.terminalId,
    lock?.id,
  ) ?? "Unknown device";
  const message = textValue(record.description, record.message, record.reason)
    ?? `${type} received from ${terminalId}`;

  return {
    id: alertIdFromPayload(payload) || `${terminalId}-${type}-${Date.now()}`,
    title: `${severity}: ${type}`,
    message,
    severity,
    device: terminalId,
  };
}

export function AlertToastListener() {
  const router = useRouter();
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: number | null = null;
    let dismissTimers: number[] = [];
    let abortController = new AbortController();

    function dismissToast(id: string) {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }

    function showToast(toast: AlertToast) {
      if (seenIds.current.has(toast.id)) return;
      seenIds.current.add(toast.id);

      setToasts((current) => [toast, ...current].slice(0, 3));

      const timer = window.setTimeout(() => dismissToast(toast.id), 7000);
      dismissTimers.push(timer);
    }

    async function waitBeforeReconnect() {
      await new Promise<void>((resolve) => {
        reconnectTimeout = window.setTimeout(resolve, 1500);
      });
    }

    async function openStream() {
      while (isMounted) {
        const token = getStoredAccessToken();

        if (!token) return;

        abortController = new AbortController();

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

              if (eventName !== "alert" || !data) continue;

              try {
                const payload = JSON.parse(data);
                window.dispatchEvent(new CustomEvent("pad-lock:alert-received", { detail: payload }));
                const toast = toastFromAlert(payload);

                if (toast) showToast(toast);
              } catch {
                // Ignore malformed stream events and keep the listener alive.
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

    function restartAfterLogin() {
      abortController.abort();
      openStream();
    }

    openStream();
    window.addEventListener("pad-lock:token-stored", restartAfterLogin);

    return () => {
      isMounted = false;
      abortController.abort();
      window.removeEventListener("pad-lock:token-stored", restartAfterLogin);

      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }

      dismissTimers.forEach((timer) => window.clearTimeout(timer));
      dismissTimers = [];
    };
  }, []);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[1000] flex w-[min(360px,calc(100vw-32px))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="relative overflow-hidden rounded-[10px] border border-[#fecaca] bg-[#dc2626] text-white shadow-[0_18px_45px_rgba(127,29,29,0.28)]"
        >
          <button
            type="button"
            onClick={() => router.push("/alarms")}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
              <BellRing size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">{toast.title}</span>
              <span className="mt-1 block line-clamp-2 text-[12px] leading-snug text-white/90">{toast.message}</span>
              <span className="mt-2 block text-[11px] font-semibold text-white/75">Equipement : {toast.device}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Dismiss alert notification"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
