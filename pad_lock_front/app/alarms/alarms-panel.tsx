"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
  Info,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, buildAlertStreamUrl, cachedApiJson, getStoredAccessToken } from "../../lib/api";

type AlarmSeverity = "Low" | "Medium" | "Critical";
type AlarmStatus = "Read" | "Unread" | "Investigating" | "Resolved";

type AlarmRow = {
  id: string;
  device: string;
  type: string;
  severity: AlarmSeverity;
  date: string;
  time: string;
  timestampMs: number | null;
  description: string;
  status: AlarmStatus;
};

type LoadState = "loading" | "ready" | "error";
type StreamState = "connecting" | "connected" | "reconnecting" | "disabled";
type AlarmRangeFilter = "last24" | "last7" | "last30" | "thisMonth";
type AlarmRangeMode = "preset" | "custom";

function rowsFromPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

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
  }

  return undefined;
}

function severityFromValue(value: unknown): AlarmSeverity {
  const text = textValue(value)?.toLowerCase();

  if (text?.includes("critical") || text?.includes("high")) return "Critical";
  if (text?.includes("medium") || text?.includes("warning")) return "Medium";
  return "Low";
}

function statusFromValue(value: unknown): AlarmStatus {
  const text = textValue(value)?.toLowerCase();

  if (text === "resolve" || text?.includes("resolved")) return "Resolved";
  if (text?.includes("investig")) return "Investigating";
  if (text?.includes("unread")) return "Unread";
  if (text === "read" || text?.includes("read")) return "Read";
  return "Unread";
}

function splitTimestamp(value: unknown) {
  const timestamp = textValue(value);

  if (!timestamp) {
    return { date: "-", time: "-", ms: null };
  }

  const date = new Date(timestamp);

  if (!Number.isNaN(date.getTime())) {
    return {
      date: date.toISOString().slice(0, 10),
      time: date.toISOString().slice(11, 19),
      ms: date.getTime(),
    };
  }

  const [datePart, timePart] = timestamp.split(/[T ]/);

  return {
    date: datePart || "-",
    time: timePart?.slice(0, 8) || "-",
    ms: null,
  };
}

function normalizeAlarms(payload: unknown): AlarmRow[] {
  return rowsFromPayload(payload).reduce<AlarmRow[]>((alarms, row, index) => {
    if (!row || typeof row !== "object") return alarms;

    const record = row as Record<string, unknown>;
    const lock =
      record.lock && typeof record.lock === "object"
        ? (record.lock as Record<string, unknown>)
        : undefined;
    const device =
      record.device && typeof record.device === "object"
        ? (record.device as Record<string, unknown>)
        : undefined;
    const timestamp = splitTimestamp(
      record.timestamp ?? record.createdAt ?? record.occurredAt ?? record.time,
    );

    const deviceLabel =
      textValue(
        record.terminalId,
        record.deviceId,
        record.lockId,
        device?.terminalId,
        device?.id,
        lock?.terminalId,
        lock?.id,
      ) ?? "Unknown device";
    const typeLabel =
      textValue(record.type, record.eventType, record.alarmType, record.kind) ??
      "Alert";

    alarms.push({
      id:
        textValue(record.id, record.uuid, record.eventId) ??
        `${deviceLabel}-${typeLabel}-${timestamp.date}-${timestamp.time}-${index}`,
      device: deviceLabel,
      type: typeLabel,
      severity: severityFromValue(record.severity ?? record.level ?? record.priority),
      date: timestamp.date,
      time: timestamp.time,
      timestampMs: timestamp.ms,
      description:
        textValue(record.description, record.message, record.reason, record.payload) ??
        "Backend alert received from connected lock device",
      status: statusFromValue(record.status ?? record.readStatus),
    });

    return alarms;
  }, []);
}

function severityClass(severity: AlarmSeverity) {
  if (severity === "Critical") return "bg-[#feecec] text-[#ef4444]";
  if (severity === "Medium") return "bg-[#fff7d6] text-[#a16207]";
  return "bg-[#eff6ff] text-[#2563eb]";
}

function statusClass(status: AlarmStatus) {
  if (status === "Resolved") return "bg-[#e8f8ee] text-[#16883f]";
  if (status === "Investigating") return "bg-[#fff7d6] text-[#a16207]";
  if (status === "Read") return "bg-[#eef4fa] text-[#496383]";
  return "bg-[#feecec] text-[#ef4444]";
}

function backendStatus(status: AlarmStatus) {
  if (status === "Resolved") return "resolve";
  if (status === "Investigating") return "investigating";
  if (status === "Read") return "read";
  return "unread";
}

function statusFromTab(tab: string) {
  if (tab === "Investigate") return "investigating";
  if (tab === "Unread") return "unread";
  if (tab === "Resolved") return "resolve";
  return undefined;
}

async function persistAlarmStatus(alarmId: string, status: AlarmStatus) {
  const response = await apiFetch(`/alerts/${encodeURIComponent(alarmId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: backendStatus(status) }),
  });

  if (!response.ok) {
    throw new Error("Backend did not accept the alert status update");
  }
}

function metricIconClass(index: number) {
  if (index === 0) return "bg-[#feecec] text-[#ef4444]";
  if (index === 1) return "bg-[#fff7d6] text-[#a16207]";
  if (index === 2) return "bg-[#eff6ff] text-[#2563eb]";
  return "bg-[#eaf8ef] text-[#16883f]";
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date());
}

const rangeOptions: { label: string; value: AlarmRangeFilter }[] = [
  { label: "Last 24 hours", value: "last24" },
  { label: "Last 7 days", value: "last7" },
  { label: "Last 30 days", value: "last30" },
  { label: "This month", value: "thisMonth" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, fallback: Date, end = false) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return end ? endOfDay(fallback) : startOfDay(fallback);
  }

  return end ? endOfDay(date) : startOfDay(date);
}

function alarmDateRange(filter: AlarmRangeFilter) {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date(to));

  if (filter === "last24") {
    from.setDate(to.getDate() - 1);
  } else if (filter === "last7") {
    from.setDate(to.getDate() - 7);
  } else if (filter === "thisMonth") {
    from.setDate(1);
  } else {
    from.setDate(to.getDate() - 30);
  }

  return { from: startOfDay(from), to };
}

function customAlarmRange(fromValue: string, toValue: string) {
  const fallback = alarmDateRange("last7");
  const from = parseDateInput(fromValue, fallback.from);
  const to = parseDateInput(toValue, fallback.to, true);

  if (from.getTime() > to.getTime()) {
    return { from: startOfDay(to), to: endOfDay(from) };
  }

  return { from, to };
}

function formatRange(from: Date, to: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

function alertsPath(from: Date, to: Date, status?: string) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  if (status) {
    params.set("status", status);
  }

  return `/alerts?${params.toString()}`;
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

function Pager({
  selectedCount,
  totalCount,
}: {
  selectedCount: number;
  totalCount: number;
}) {
  const pageCount = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <div className="flex items-center justify-between py-4 text-[12px] text-[#64748b]">
      <span>
        {selectedCount} of {totalCount} row(s) selected.
      </span>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-[#111827]">Rows per page</span>
        <button className="flex h-8 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3" type="button">
          10
          <ChevronDown size={12} />
        </button>
        <span className="font-semibold text-[#111827]">Page 1 of {pageCount}</span>
        <div className="flex gap-2">
          {[ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight].map((Icon, index) => (
            <button key={index} type="button" className="grid size-8 place-items-center rounded-[6px] bg-white text-[#94a3b8]">
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AlarmsPanel() {
  const defaultRange = useMemo(() => alarmDateRange("last7"), []);
  const [alarms, setAlarms] = useState<AlarmRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Summary");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [rangeMode, setRangeMode] = useState<AlarmRangeMode>("preset");
  const [rangeFilter, setRangeFilter] = useState<AlarmRangeFilter>("last7");
  const [customFrom, setCustomFrom] = useState(() => dateInputValue(defaultRange.from));
  const [customTo, setCustomTo] = useState(() => dateInputValue(defaultRange.to));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingStatusIds, setPendingStatusIds] = useState<string[]>([]);
  const [exported, setExported] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("Loading backend alerts...");
  const [actionLabel, setActionLabel] = useState("");
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [streamLabel, setStreamLabel] = useState("Live alert stream connecting...");
  const range = useMemo(
    () => (rangeMode === "custom" ? customAlarmRange(customFrom, customTo) : alarmDateRange(rangeFilter)),
    [customFrom, customTo, rangeFilter, rangeMode],
  );
  const selectedRangeLabel =
    rangeMode === "custom"
      ? "Custom range"
      : (rangeOptions.find((option) => option.value === rangeFilter)?.label ?? "Last 7 days");
  const backendStatusFilter = useMemo(() => statusFromTab(tab), [tab]);
  const alertListPath = useMemo(
    () => alertsPath(range.from, range.to, backendStatusFilter),
    [backendStatusFilter, range.from, range.to],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAlerts() {
      setLoadState("loading");
      setSourceLabel("Loading backend alerts...");

      try {
        const payload = await cachedApiJson(alertListPath, true);
        const normalized = normalizeAlarms(payload);

        if (!isMounted) return;

        setAlarms(normalized);
        setLoadState("ready");
        setSourceLabel(
          normalized.length > 0
            ? `Loaded backend alerts for ${selectedRangeLabel}`
            : `Backend returned 0 alerts for ${selectedRangeLabel}`,
        );
        setSelectedIds([]);
        setOpenMenuId(null);
      } catch {
        if (isMounted) {
          setAlarms([]);
          setLoadState("error");
          setSourceLabel("Could not load backend alerts");
          setSelectedIds([]);
          setOpenMenuId(null);
        }
      }
    }

    loadAlerts();

    return () => {
      isMounted = false;
    };
  }, [alertListPath, selectedRangeLabel]);
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: number | null = null;
    const abortController = new AbortController();

    function addStreamAlert(payload: unknown) {
      const [incomingAlert] = normalizeAlarms([payload]);

      if (!incomingAlert || !isMounted) return;

      setAlarms((currentAlarms) => {
        const existingIndex = currentAlarms.findIndex(
          (alarm) => alarm.id === incomingAlert.id,
        );

        if (existingIndex === -1) {
          return [incomingAlert, ...currentAlarms];
        }

        return currentAlarms.map((alarm, index) =>
          index === existingIndex ? incomingAlert : alarm,
        );
      });
      setLoadState("ready");
      setSourceLabel("Loaded from backend alerts");
    }
    async function waitBeforeReconnect() {
      await new Promise<void>((resolve) => {
        reconnectTimeout = window.setTimeout(resolve, 1500);
      });
    }

    async function openAlertStream() {
      await Promise.resolve();

      while (isMounted && !abortController.signal.aborted) {
        const token = getStoredAccessToken();

        if (!token) {
          setStreamState("disabled");
          setStreamLabel("Live stream waiting for login token");
          return;
        }

        try {
          setStreamState((currentState) =>
            currentState === "connected" ? "reconnecting" : "connecting",
          );
          setStreamLabel("Live alert stream connecting...");

          const response = await fetch(buildAlertStreamUrl(), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: abortController.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error("Could not open alert stream");
          }

          if (!isMounted) return;

          setStreamState("connected");
          setStreamLabel("Live alert stream connected");

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

              if (eventName === "keepalive") {
                setStreamState("connected");
                setStreamLabel("Live alert stream connected");
              }

              if (eventName === "alert" && data) {
                try {
                  addStreamAlert(JSON.parse(data));
                } catch {
                  setStreamLabel("Live alert stream received an unreadable event");
                }
              }
            }
          }
        } catch {
          if (!isMounted || abortController.signal.aborted) return;

          setStreamState("reconnecting");
          setStreamLabel("Live alert stream reconnecting...");
        }

        if (isMounted && !abortController.signal.aborted) {
          await waitBeforeReconnect();
        }
      }
    }

    openAlertStream();

    return () => {
      isMounted = false;
      abortController.abort();

      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const alarmTypes = useMemo(
    () => ["All types", ...Array.from(new Set(alarms.map((alarm) => alarm.type)))],
    [alarms],
  );

  const metrics = useMemo(
    () => [
      {
        label: "Critical Alarms",
        value: alarms.filter((alarm) => alarm.severity === "Critical").length,
        icon: Info,
      },
      {
        label: "Unread Alerts",
        value: alarms.filter((alarm) => alarm.status === "Unread").length,
        icon: Bell,
      },
      {
        label: "Active Investigations",
        value: alarms.filter((alarm) => alarm.status === "Investigating").length,
        icon: Info,
      },
      {
        label: "Resolved Today",
        value: alarms.filter((alarm) => alarm.status === "Resolved").length,
        icon: Check,
      },
    ],
    [alarms],
  );

  const filteredAlarms = useMemo(() => {
    return alarms.filter((alarm) => {
      const matchesQuery = `${alarm.device} ${alarm.type} ${alarm.severity} ${alarm.description} ${alarm.status}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesTab =
        tab === "Summary" ||
        (tab === "Investigate" && alarm.status === "Investigating") ||
        (tab === "Unread" && alarm.status === "Unread") ||
        (tab === "Resolved" && alarm.status === "Resolved");
      const matchesType = typeFilter === "All types" || alarm.type === typeFilter;
      const matchesSeverity =
        severityFilter === "All Severities" || alarm.severity === severityFilter;
      const matchesRange =
        alarm.timestampMs === null ||
        (alarm.timestampMs >= range.from.getTime() && alarm.timestampMs <= range.to.getTime());

      return matchesQuery && matchesTab && matchesType && matchesSeverity && matchesRange;
    });
  }, [alarms, query, range.from, range.to, severityFilter, tab, typeFilter]);

  const allSelected =
    filteredAlarms.length > 0 &&
    filteredAlarms.every((alarm) => selectedIds.includes(alarm.id));
  const emptyMessage =
    loadState === "loading"
      ? "Loading backend alerts..."
      : loadState === "error"
        ? "Could not load backend alerts. Check your login token and backend connection."
        : alarms.length === 0
          ? "No backend alerts returned yet."
          : "No alarms match your filters.";

  async function updateAlarmStatus(alarmId: string, status: AlarmStatus) {
    const previousAlarm = alarms.find((alarm) => alarm.id === alarmId);

    setAlarms((currentAlarms) =>
      currentAlarms.map((alarm) =>
        alarm.id === alarmId ? { ...alarm, status } : alarm,
      ),
    );
    setOpenMenuId(null);
    setPendingStatusIds((currentIds) => Array.from(new Set([...currentIds, alarmId])));
    setActionLabel(`Saving ${status.toLowerCase()} status...`);

    try {
      await persistAlarmStatus(alarmId, status);
      setActionLabel(`Alert marked ${status.toLowerCase()} in backend`);
    } catch {
      if (previousAlarm) {
        setAlarms((currentAlarms) =>
          currentAlarms.map((alarm) =>
            alarm.id === alarmId ? previousAlarm : alarm,
          ),
        );
      }
      setActionLabel("Backend did not accept the alert status update");
    } finally {
      setPendingStatusIds((currentIds) => currentIds.filter((id) => id !== alarmId));
    }
  }

  function toggleSelected(alarmId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(alarmId)
        ? currentIds.filter((id) => id !== alarmId)
        : [...currentIds, alarmId],
    );
  }

  function toggleAll() {
    setSelectedIds((currentIds) => {
      if (allSelected) {
        return currentIds.filter((id) => !filteredAlarms.some((alarm) => alarm.id === id));
      }

      return Array.from(new Set([...currentIds, ...filteredAlarms.map((alarm) => alarm.id)]));
    });
  }

  async function markAllAsRead() {
    const unreadIds = alarms.filter((alarm) => alarm.status === "Unread").map((alarm) => alarm.id);

    if (unreadIds.length === 0) {
      setActionLabel("No unread alerts to update");
      return;
    }

    setAlarms((currentAlarms) =>
      currentAlarms.map((alarm) =>
        alarm.status === "Unread" ? { ...alarm, status: "Read" } : alarm,
      ),
    );
    setPendingStatusIds((currentIds) => Array.from(new Set([...currentIds, ...unreadIds])));
    setActionLabel("Saving read status for unread alerts...");

    const results = await Promise.allSettled(
      unreadIds.map((alarmId) => persistAlarmStatus(alarmId, "Read")),
    );
    const failedIds = unreadIds.filter((_, index) => results[index]?.status === "rejected");

    if (failedIds.length > 0) {
      setAlarms((currentAlarms) =>
        currentAlarms.map((alarm) =>
          failedIds.includes(alarm.id) ? { ...alarm, status: "Unread" } : alarm,
        ),
      );
      setActionLabel(`${failedIds.length} alert status update(s) were not accepted by backend`);
    } else {
      setActionLabel("Unread alerts marked read in backend");
    }

    setPendingStatusIds((currentIds) => currentIds.filter((id) => !unreadIds.includes(id)));
  }

  return (
    <div className="w-full px-4 py-7 md:px-6">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h1 className="text-[26px] font-bold tracking-normal text-black">Alarm Records</h1>
          <p className="mt-2 text-[13px] text-[#64748b]">
            Monitor and respond to real-time security and operational alerts.
          </p>
          <p className="mt-1 text-[11px] text-[#94a3b8]">
            {sourceLabel} - {streamLabel}
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
              streamState === "connected"
                ? "bg-[#e8f8ee] text-[#16883f]"
                : streamState === "reconnecting"
                  ? "bg-[#fff7d6] text-[#a16207]"
                  : "bg-[#eef4fa] text-[#64748b]"
            }`}
          >
            {streamState === "connected"
              ? "Live"
              : streamState === "reconnecting"
                ? "Reconnecting"
                : "Stream pending"}
          </span>
        </div>
        <button
          type="button"
          onClick={markAllAsRead}
          className="flex h-9 w-fit items-center gap-2 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white"
        >
          <Check size={14} />
          Mark all as read
        </button>
      </div>

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <article
            key={metric.label}
            className="flex min-h-[70px] items-center gap-4 rounded-[8px] border border-[#dfe6ee] bg-white px-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]"
          >
            <span className={`grid size-10 place-items-center rounded-full ${metricIconClass(index)}`}>
              <metric.icon size={17} />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-[#111827]">{metric.label}</p>
              <p className="mt-1 text-[25px] font-bold leading-none text-[#111827]">
                {metric.value}
              </p>
            </div>
          </article>
        ))}
      </section>

      <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-[14px] font-bold">Alarm Records</h2>
          {actionLabel ? <p className="mt-1 text-[11px] font-medium text-[#64748b]">{actionLabel}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"
          >
            <CalendarDays size={14} />
            Today, {formatTodayLabel()}
          </button>
          <label
            className={`flex h-9 items-center gap-2 rounded-[6px] border bg-white px-3 text-[12px] font-semibold transition ${
              rangeMode === "preset" ? "border-[#2A9D90] shadow-[0_0_0_2px_rgba(42,157,144,0.08)]" : "border-[#dfe6ee]"
            }`}
          >
            <select
              aria-label="Alarm preset range"
              value={rangeFilter}
              onChange={(event) => {
                setRangeMode("preset");
                setRangeFilter(event.target.value as AlarmRangeFilter);
              }}
              className="min-w-[118px] bg-transparent outline-none"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div
            className={`flex min-h-9 flex-wrap items-center gap-2 rounded-[6px] border bg-white px-2 py-1 transition ${
              rangeMode === "custom" ? "border-[#2A9D90] shadow-[0_0_0_2px_rgba(42,157,144,0.08)]" : "border-[#dfe6ee]"
            }`}
          >
            <button
              type="button"
              onClick={() => setRangeMode("custom")}
              className={`h-7 rounded-[5px] px-2.5 text-[11px] font-semibold transition ${
                rangeMode === "custom" ? "bg-[#e7f8f5] text-[#0f766e]" : "text-[#475569] hover:bg-[#f8fafc]"
              }`}
            >
              Range
            </button>
            <input
              aria-label="Alarm custom range start"
              type="date"
              value={customFrom}
              onChange={(event) => {
                setRangeMode("custom");
                setCustomFrom(event.target.value);
              }}
              className="h-7 rounded-[5px] border border-[#e2e8f0] px-2 text-[11px] font-medium outline-none focus:border-[#2A9D90]"
            />
            <span className="text-[10px] font-semibold text-[#94a3b8]">to</span>
            <input
              aria-label="Alarm custom range end"
              type="date"
              value={customTo}
              onChange={(event) => {
                setRangeMode("custom");
                setCustomTo(event.target.value);
              }}
              className="h-7 rounded-[5px] border border-[#e2e8f0] px-2 text-[11px] font-medium outline-none focus:border-[#2A9D90]"
            />
          </div>
          <span className="text-[11px] font-medium text-[#64748b]">{formatRange(range.from, range.to)}</span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid rounded-[6px] bg-[#f1f1f2] p-0.5 text-[12px] font-medium text-[#64748b] sm:grid-cols-4">
          {["Summary", "Investigate", "Unread", "Resolved"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`h-8 rounded-[5px] transition ${
                tab === item ? "bg-white text-[#111827] shadow-sm" : "hover:text-[#111827]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExported(true)}
          className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"
        >
          <Upload size={14} />
          {exported ? "Exported" : "Export"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(240px,1fr)_140px_150px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
            placeholder="Search"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-9 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-medium outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
        >
          {alarmTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value)}
          className="h-9 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-medium outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
        >
          {["All Severities", "Low", "Medium", "Critical"].map((severity) => (
            <option key={severity}>{severity}</option>
          ))}
        </select>
      </div>

      <div className="overflow-visible rounded-[7px] border border-[#dfe6ee] bg-white">
        <div className="grid grid-cols-[48px_1fr_1.1fr_90px_1.1fr_2.1fr_100px_70px] border-b border-[#dfe6ee] px-4 py-3 text-[12px] font-medium text-[#496383]">
          <input checked={allSelected} onChange={toggleAll} type="checkbox" aria-label="Select all alarms" />
          <span>Device</span>
          <span>Type</span>
          <span>Severity</span>
          <span>Timestamp</span>
          <span>Description</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {filteredAlarms.map((alarm, index) => (
          <div
            key={alarm.id}
            className={`relative grid grid-cols-[48px_1fr_1.1fr_90px_1.1fr_2.1fr_100px_70px] items-center border-b border-[#dfe6ee] px-4 py-4 text-[12px] ${
              index === 1 ? "bg-[#f1f1f2]" : "bg-white"
            }`}
          >
            <input checked={selectedIds.includes(alarm.id)} onChange={() => toggleSelected(alarm.id)} type="checkbox" aria-label={`Select ${alarm.type}`} />
            <span>{alarm.device}</span>
            <span>{alarm.type}</span>
            <span>
              <span className={`rounded-[5px] px-2 py-1 text-[11px] font-medium ${severityClass(alarm.severity)}`}>
                {alarm.severity}
              </span>
            </span>
            <span>
              {alarm.date}
              <br />
              <span className="text-[#64748b]">{alarm.time}</span>
            </span>
            <span className="pr-3">{alarm.description}</span>
            <span>
              <span className={`rounded-[5px] px-2 py-1 text-[11px] font-semibold ${statusClass(alarm.status)}`}>
                {pendingStatusIds.includes(alarm.id) ? "Saving..." : alarm.status}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpenMenuId(openMenuId === alarm.id ? null : alarm.id)}
              className="grid size-7 place-items-center rounded-[5px] hover:bg-[#eef4fa]"
              aria-label={`Open actions for ${alarm.type}`}
            >
              <Ellipsis size={16} />
            </button>
            {openMenuId === alarm.id ? (
              <div className="absolute right-8 top-10 z-10 w-[145px] overflow-hidden rounded-[6px] border border-[#dfe6ee] bg-white py-1 text-[12px] shadow-lg">
                <button type="button" onClick={() => updateAlarmStatus(alarm.id, "Read")} className="block h-8 w-full px-3 text-left hover:bg-[#eef4fa]">
                  Mark read
                </button>
                <button type="button" onClick={() => updateAlarmStatus(alarm.id, "Investigating")} className="block h-8 w-full px-3 text-left hover:bg-[#eef4fa]">
                  Investigate
                </button>
                <button type="button" onClick={() => updateAlarmStatus(alarm.id, "Resolved")} className="block h-8 w-full px-3 text-left hover:bg-[#eef4fa]">
                  Resolve
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {filteredAlarms.length === 0 ? (
          <div className="grid h-44 place-items-center text-[13px] font-medium text-[#64748b]">
            {emptyMessage}
          </div>
        ) : null}
      </div>

      <Pager selectedCount={selectedIds.length} totalCount={alarms.length} />
    </div>
  );
}
