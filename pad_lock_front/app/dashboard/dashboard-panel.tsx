"use client";

import {
  Activity,
  CalendarDays,
  ChartNoAxesColumn,
  CircleAlert,
  CircleGauge,
  Database,
  Globe2,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cachedApiJson } from "../../lib/api";

type SummaryRecord = Record<string, unknown>;
type LoadState = "loading" | "ready" | "error";
type DashboardRangeFilter = "last7" | "last30" | "thisMonth" | "lastQuarter";
type DashboardRangeMode = "preset" | "custom";

type Metric = {
  label: string;
  value: number;
  trend: string;
  icon: typeof Database;
};

type NamedCount = {
  label: string;
  value: number;
};

function asRecord(value: unknown): SummaryRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SummaryRecord)
    : undefined;
}

function rowsFromValue(value: unknown) {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (!record) return [];

  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.rows)) return record.rows;

  return [];
}

function unwrapPayload(payload: unknown) {
  const record = asRecord(payload);

  if (!record) return {};

  const data = asRecord(record.data);
  const summary = asRecord(record.summary);

  if (data) {
    return summary ? { ...data, summary, ...summary } : data;
  }

  return summary ? { ...record, ...summary } : record;
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }

  return undefined;
}

function translateDashboardLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  const translations: Record<string, string> = {
    alarm: "Alarmes",
    alarms: "Alarmes",
    alert: "Alertes",
    alerts: "Alertes",
    moving: "En mouvement",
    movement: "En mouvement",
    idle: "A l'arret",
    stopped: "A l'arret",
    stopping: "A l'arret",
    locked: "Verrouilles",
    unlocked: "Deverrouilles",
    online: "En ligne",
    offline: "Hors ligne",
    other: "Autres",
  };

  return translations[normalized] ?? label;
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function numberFromRecord(record: SummaryRecord | undefined, keys: string[]) {
  if (!record) return undefined;

  for (const key of keys) {
    const value = numberValue(record[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function getSection(summary: SummaryRecord, key: string) {
  const direct = asRecord(summary[key]);
  if (direct) return direct;

  const nested = findDashboardValue(summary, [key]);
  return asRecord(nested);
}

function findDashboardValue(value: unknown, keys: string[], depth = 0): unknown {
  if (depth > 4) return undefined;

  const record = asRecord(value);
  if (!record) return undefined;

  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }

  for (const [recordKey, recordValue] of Object.entries(record)) {
    if (["data", "summary", "dashboard", "analytics", "charts", "reports", "stats", "statistics"].includes(recordKey)) {
      const found = findDashboardValue(recordValue, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }

  for (const recordValue of Object.values(record)) {
    if (Array.isArray(recordValue)) continue;

    const found = findDashboardValue(recordValue, keys, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function numberFromDashboard(summary: SummaryRecord, keys: string[]) {
  return numberValue(findDashboardValue(summary, keys));
}

function findKpiValue(kpis: unknown, labels: string[]) {
  const rows = rowsFromValue(kpis);
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;

    const rowLabel = textValue(record.label, record.name, record.key, record.title)?.toLowerCase();

    if (rowLabel && normalizedLabels.some((label) => rowLabel.includes(label))) {
      return numberValue(record.value, record.count, record.total, record.amount);
    }
  }

  return undefined;
}

function getMetricValue(
  summary: SummaryRecord,
  labels: string[],
  objectKeys: string[],
) {
  const kpis = summary.kpis;
  const kpiRecord = asRecord(kpis);

  return (
    numberFromRecord(kpiRecord, objectKeys) ??
    numberFromRecord(summary, objectKeys) ??
    numberFromDashboard(summary, objectKeys) ??
    findKpiValue(kpis, labels) ??
    0
  );
}

function trendFor(summary: SummaryRecord, label: string) {
  const kpis = summary.kpis;
  const rows = rowsFromValue(kpis);
  const normalizedLabel = label.toLowerCase();

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;

    const rowLabel = textValue(record.label, record.name, record.key, record.title)?.toLowerCase();

    if (rowLabel?.includes(normalizedLabel)) {
      return textValue(record.trend, record.change, record.delta, record.subtitle) ?? "Valeur mise a jour";
    }
  }

  return "Valeur mise a jour";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

const rangeOptions: { label: string; value: DashboardRangeFilter }[] = [
  { label: "7 derniers jours", value: "last7" },
  { label: "30 derniers jours", value: "last30" },
  { label: "Ce mois", value: "thisMonth" },
  { label: "Dernier trimestre", value: "lastQuarter" },
];

function dateRange(filter: DashboardRangeFilter) {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date(to));

  if (filter === "last7") {
    from.setDate(to.getDate() - 7);
  } else if (filter === "thisMonth") {
    from.setDate(1);
  } else if (filter === "lastQuarter") {
    from.setMonth(to.getMonth() - 3);
  } else {
    from.setDate(to.getDate() - 30);
  }

  return { from: startOfDay(from), to };
}

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

function customRange(fromValue: string, toValue: string) {
  const fallback = dateRange("last30");
  const from = parseDateInput(fromValue, fallback.from);
  const to = parseDateInput(toValue, fallback.to, true);

  if (from.getTime() > to.getTime()) {
    return { from: startOfDay(to), to: endOfDay(from) };
  }

  return { from, to };
}

function formatRange(from: Date, to: Date) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

function dashboardPath(from: Date, to: Date) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  return `/dashboard/summary?${params.toString()}`;
}

function normalizeNamedCounts(value: unknown, fallbackLabel = "Item") {
  const record = asRecord(value);

  if (record && rowsFromValue(value).length === 0) {
    return Object.entries(record)
      .map(([key, itemValue]) => ({ label: translateDashboardLabel(key), value: numberValue(itemValue) ?? 0 }))
      .filter((item) => item.value > 0);
  }

  return rowsFromValue(value)
    .map((row, index): NamedCount | null => {
      const item = asRecord(row);
      if (!item) return null;

      return {
        label: translateDashboardLabel(
          textValue(
            item.label,
            item.name,
            item.title,
            item.cardId,
            item.rfid,
            item.rfidCard,
            item.cardNumber,
            item.uid,
            item.location,
            item.city,
            item.place,
            item.type,
            item.status,
            item.key,
            item.terminalId,
          ) ?? `${fallbackLabel} ${index + 1}`,
        ),
        value:
          numberValue(
            item.value,
            item.count,
            item.total,
            item.assets,
            item.usage,
            item.uses,
            item.openings,
            item.unlocks,
            item.events,
            item.samples,
            item.visits,
            item.points,
            item.activity,
          ) ?? 0,
      };
    })
    .filter((item): item is NamedCount => Boolean(item));
}

function normalizeLockActivities(summary: SummaryRecord) {
  const direct = firstNamedCounts(
    summary,
    ["lockActivities", "lockActivityByType", "activityByType", "lockStatusBreakdown", "activities", "eventsByType"],
    "Activite",
  );

  if (direct.length > 0) return direct.slice(0, 8);

  const totalAssets = getMetricValue(summary, ["total assets", "assets", "locks"], ["totalAssets", "assets", "total", "locks", "totalLocks"]);
  const alarms = getMetricValue(summary, ["alarm", "alert"], ["alarm", "alarms", "alerts", "alertCount"]);
  const moving = getMetricValue(summary, ["moving", "movement"], ["moving", "movingAssets", "movement"]);
  const stopping = getMetricValue(summary, ["idle", "stopped"], ["idle", "idleAssets", "stopped", "stopping"]);
  const locked = getMetricValue(summary, ["locked"], ["locked", "lockedAssets", "lockedLocks"]);
  const unlocked = getMetricValue(summary, ["unlocked"], ["unlocked", "unlockedAssets", "unlockedLocks"]);
  const other = Math.max(0, totalAssets - moving - stopping);

  return [
    { label: "Alarmes", value: alarms },
    { label: "En mouvement", value: moving },
    { label: "A l'arret", value: stopping },
    { label: "Verrouilles", value: locked },
    { label: "Deverrouilles", value: unlocked },
    { label: "Autres", value: other },
  ].filter((item) => item.value > 0);
}

function firstNamedCounts(summary: SummaryRecord, keys: string[], fallbackLabel: string) {
  for (const key of keys) {
    const rows = normalizeNamedCounts(findDashboardValue(summary, [key]), fallbackLabel);
    if (rows.length > 0) return rows;
  }

  return [];
}

function normalizeRfidUsage(summary: SummaryRecord) {
  const rows = firstNamedCounts(
    summary,
    [
      "rfidUsage",
      "topRfidCards",
      "rfidCards",
      "mostUsedRfids",
      "mostUsedRfidCards",
      "rfidUsageRanking",
      "topCards",
      "cardUsage",
      "rfid",
      "rfids",
      "cards",
    ],
    "Carte RFID",
  );

  return rows.slice(0, 8);
}

function normalizeHeatMapTracks(summary: SummaryRecord) {
  const rows = firstNamedCounts(
    summary,
    [
      "heatMapTracks",
      "trackHeatMap",
      "tracksHeatMap",
      "lockHeatMap",
      "locationHeatMap",
      "locationsHeatMap",
      "topLocations",
      "locations",
      "cityActivity",
      "heatmap",
      "heatMap",
      "tracks",
      "places",
    ],
    "Lieu",
  );

  return rows.slice(0, 12);
}

function connectionValues(summary: SummaryRecord) {
  const connection = getSection(summary, "connectionStatus");
  const online =
    numberFromRecord(connection, ["online", "connected", "active"]) ??
    getMetricValue(summary, ["online"], ["online", "onlineAssets", "connected"]);
  const offline =
    numberFromRecord(connection, ["offline", "disconnected", "inactive"]) ??
    getMetricValue(summary, ["offline"], ["offline", "offlineAssets", "disconnected"]);
  const total = Math.max(online + offline, 0);
  const percent =
    numberFromRecord(connection, ["percentage", "percent", "onlinePercent", "onlinePercentage"]) ??
    (total > 0 ? Math.round((online / total) * 100) : 0);

  return { online, offline, percent };
}

function buildMetrics(summary: SummaryRecord): Metric[] {
  const connection = connectionValues(summary);

  return [
    {
      label: "Total des cadenas",
      value: getMetricValue(summary, ["total assets", "assets", "locks"], ["totalAssets", "assets", "total", "locks", "totalLocks"]),
      trend: trendFor(summary, "total"),
      icon: Database,
    },
    { label: "En ligne", value: connection.online, trend: trendFor(summary, "online"), icon: Wifi },
    { label: "Hors ligne", value: connection.offline, trend: trendFor(summary, "offline"), icon: WifiOff },
    {
      label: "En mouvement",
      value: getMetricValue(summary, ["moving", "movement"], ["moving", "movingAssets", "movement"]),
      trend: trendFor(summary, "moving"),
      icon: Activity,
    },
    {
      label: "A l'arret",
      value: getMetricValue(summary, ["idle"], ["idle", "idleAssets"]),
      trend: trendFor(summary, "idle"),
      icon: CircleGauge,
    },
    {
      label: "Verrouilles",
      value: getMetricValue(summary, ["locked"], ["locked", "lockedAssets", "lockedLocks"]),
      trend: trendFor(summary, "locked"),
      icon: Lock,
    },
    {
      label: "Deverrouilles",
      value: getMetricValue(summary, ["unlocked"], ["unlocked", "unlockedAssets", "unlockedLocks"]),
      trend: trendFor(summary, "unlocked"),
      icon: Unlock,
    },
    {
      label: "Alarmes",
      value: getMetricValue(summary, ["alarm", "alert"], ["alarm", "alarms", "alerts", "alertCount"]),
      trend: trendFor(summary, "alarm"),
      icon: CircleAlert,
    },
  ];
}

function barHeight(value: number, max: number, min = 14) {
  if (max <= 0) return min;
  return Math.max(min, Math.round((value / max) * 100));
}

export function DashboardPanel() {
  const defaultRange = useMemo(() => dateRange("last30"), []);
  const [rangeMode, setRangeMode] = useState<DashboardRangeMode>("preset");
  const [rangeFilter, setRangeFilter] = useState<DashboardRangeFilter>("last30");
  const [customFrom, setCustomFrom] = useState(() => dateInputValue(defaultRange.from));
  const [customTo, setCustomTo] = useState(() => dateInputValue(defaultRange.to));
  const range = useMemo(
    () => (rangeMode === "custom" ? customRange(customFrom, customTo) : dateRange(rangeFilter)),
    [customFrom, customTo, rangeFilter, rangeMode],
  );
  const selectedRangeLabel =
    rangeMode === "custom"
      ? "Periode personnalisee"
      : (rangeOptions.find((option) => option.value === rangeFilter)?.label ?? "30 derniers jours");
  const [summary, setSummary] = useState<SummaryRecord>({});
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoadState("loading");

      try {
        const payload = await cachedApiJson(dashboardPath(range.from, range.to), true);

        if (!isMounted) return;

        setSummary(unwrapPayload(payload));
        setLoadState("ready");
      } catch {
        if (!isMounted) return;

        setSummary({});
        setLoadState("error");
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [range.from, range.to]);

  const metrics = useMemo(() => buildMetrics(summary), [summary]);
  const connection = useMemo(() => connectionValues(summary), [summary]);
  const lockActivities = useMemo(() => normalizeLockActivities(summary), [summary]);
  const rfidUsage = useMemo(() => normalizeRfidUsage(summary), [summary]);
  const heatMapTracks = useMemo(() => normalizeHeatMapTracks(summary), [summary]);
  const maxLockActivity = Math.max(...lockActivities.map((item) => item.value), 0);
  const maxRfidUsage = Math.max(...rfidUsage.map((item) => item.value), 0);
  const maxHeatMapTrack = Math.max(...heatMapTracks.map((item) => item.value), 0);
  const locked = getMetricValue(summary, ["locked"], ["locked", "lockedAssets", "lockedLocks"]);
  const unlocked = getMetricValue(summary, ["unlocked"], ["unlocked", "unlockedAssets", "unlockedLocks"]);
  const sourceLabel =
    loadState === "loading"
      ? "Chargement du tableau de bord..."
      : loadState === "error"
        ? "Impossible de charger les donnees du tableau de bord"
        : "Donnees du tableau de bord chargees depuis le serveur";

  return (
    <div className="w-full px-4 py-7 md:px-5 xl:px-6">
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-[26px] font-bold tracking-normal text-black">Tableau de bord</h1>
          <p className="mt-1 text-[12px] text-[#718096]">{sourceLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`flex h-10 w-fit items-center gap-2 rounded-[7px] border bg-white px-3 text-[13px] font-medium text-[#1f2937] transition ${
              rangeMode === "preset" ? "border-[#2A9D90] shadow-[0_0_0_2px_rgba(42,157,144,0.08)]" : "border-[#dfe6ee]"
            }`}
          >
            <CalendarDays size={16} />
            <select
              aria-label="Periode predefinie du tableau de bord"
              value={rangeFilter}
              onChange={(event) => {
                setRangeMode("preset");
                setRangeFilter(event.target.value as DashboardRangeFilter);
              }}
              className="min-w-[118px] bg-transparent text-[13px] font-semibold text-[#1f2937] outline-none"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div
            className={`flex min-h-10 flex-wrap items-center gap-2 rounded-[7px] border bg-white px-2 py-1 transition ${
              rangeMode === "custom" ? "border-[#2A9D90] shadow-[0_0_0_2px_rgba(42,157,144,0.08)]" : "border-[#dfe6ee]"
            }`}
          >
            <button
              type="button"
              onClick={() => setRangeMode("custom")}
              className={`h-8 rounded-[6px] px-3 text-[12px] font-semibold transition ${
                rangeMode === "custom" ? "bg-[#e7f8f5] text-[#0f766e]" : "text-[#475569] hover:bg-[#f8fafc]"
              }`}
            >
              Periode
            </button>
            <input
              aria-label="Date de debut du tableau de bord"
              type="date"
              value={customFrom}
              onChange={(event) => {
                setRangeMode("custom");
                setCustomFrom(event.target.value);
              }}
              className="h-8 rounded-[6px] border border-[#e2e8f0] px-2 text-[12px] font-medium text-[#1f2937] outline-none focus:border-[#2A9D90]"
            />
            <span className="text-[11px] font-semibold text-[#94a3b8]">au</span>
            <input
              aria-label="Date de fin du tableau de bord"
              type="date"
              value={customTo}
              onChange={(event) => {
                setRangeMode("custom");
                setCustomTo(event.target.value);
              }}
              className="h-8 rounded-[6px] border border-[#e2e8f0] px-2 text-[12px] font-medium text-[#1f2937] outline-none focus:border-[#2A9D90]"
            />
          </div>

          <span className="w-full text-[11px] font-medium text-[#64748b] sm:w-auto">
            {formatRange(range.from, range.to)}
          </span>
        </div>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition hover:border-[#cbd5e1] hover:shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold text-[#64748b]">{metric.label}</p>
                <p className="mt-4 text-[30px] font-bold leading-none text-[#0f172a]">{formatNumber(metric.value)}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-[8px] border border-[#e6edf4] bg-[#fbfdff] text-[#64748b]">
                <metric.icon size={16} strokeWidth={1.8} />
              </span>
            </div>
            <div className="mt-5 h-px bg-[#eef2f7]" />
            <p className="mt-3 truncate text-[11px] font-medium text-[#718096]">{metric.trend}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <article className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-3 border-b border-[#e6edf4] px-5 py-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[15px] font-bold">Activites des cadenas</h2>
              <p className="mt-1 text-[12px] text-[#718096]">Repartition des alarmes, mouvements, arrets, verrouillages et deverrouillages</p>
            </div>
            <button type="button" className="h-9 w-fit rounded-[7px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-medium text-[#475569]">{selectedRangeLabel}</button>
          </div>

          {lockActivities.length > 0 ? (
            <div className="grid min-h-[292px] gap-0 lg:grid-cols-[265px_1fr]">
              <div className="relative overflow-hidden border-r border-[#e6edf4] bg-white p-5 text-[#0f172a]">
                <div className="absolute -right-12 -top-12 size-40 rounded-full bg-[#2A9D90]/20 blur-2xl" />
                <div className="absolute -bottom-14 left-8 size-36 rounded-full bg-[#1E9ADA]/15 blur-2xl" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase text-[#64748b]">Activite totale</p>
                  <p className="mt-3 text-[42px] font-bold leading-none">{formatNumber(lockActivities.reduce((total, item) => total + item.value, 0))}</p>
                  <p className="mt-2 text-[12px] text-[#64748b]">evenements sur la periode selectionnee</p>

                  <div className="mt-6 grid place-items-center">
                    {(() => {
                      const total = lockActivities.reduce((sum, item) => sum + item.value, 0);
                      let cursor = 0;
                      const colors = ["#ef4444", "#2A9D90", "#f97316", "#a16207", "#34C759", "#94a3b8", "#1E9ADA", "#64748b"];
                      const gradient = lockActivities.map((item, index) => {
                        const start = total > 0 ? (cursor / total) * 360 : 0;
                        cursor += item.value;
                        const stop = total > 0 ? (cursor / total) * 360 : 0;
                        return colors[index % colors.length] + " " + start + "deg " + stop + "deg";
                      }).join(", ");
                      return (
                        <div className="relative grid size-[150px] place-items-center rounded-full" style={{ background: "conic-gradient(" + gradient + ")" }}>
                          <div className="grid size-[102px] place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
                            <div className="text-center">
                              <p className="text-[22px] font-bold leading-none">{lockActivities.length}</p>
                              <p className="mt-1 text-[10px] uppercase text-[#64748b]">signaux</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="bg-[#fbfdff] p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {lockActivities.slice(0, 6).map((item, index) => {
                    const colors = ["#ef4444", "#2A9D90", "#f97316", "#a16207", "#34C759", "#94a3b8"];
                    const percent = maxLockActivity > 0 ? Math.round((item.value / maxLockActivity) * 100) : 0;
                    return (
                      <div key={`${item.label}-${index}`} className="rounded-[8px] border border-[#e2e8f0] bg-white p-3 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                          <span className="text-[10px] font-bold uppercase text-[#94a3b8]">{percent}%</span>
                        </div>
                        <p className="mt-4 truncate text-[12px] font-bold text-[#111827]">{item.label}</p>
                        <p className="mt-1 text-[22px] font-bold leading-none text-[#0f172a]">{formatNumber(item.value)}</p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]"><div className="h-full rounded-full" style={{ width: String(percent) + "%", backgroundColor: colors[index % colors.length] }} /></div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-[8px] border border-[#e2e8f0] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] font-bold text-[#111827]">Classement des activites</p>
                    <p className="text-[11px] text-[#64748b]">Volume le plus eleve en premier</p>
                  </div>
                  <div className="space-y-3">
                    {[...lockActivities].sort((a, b) => b.value - a.value).slice(0, 5).map((item, index) => {
                      const percent = maxLockActivity > 0 ? Math.round((item.value / maxLockActivity) * 100) : 0;
                      return (
                        <div key={`${item.label}-${index}`} className="grid grid-cols-[24px_92px_1fr_48px] items-center gap-3 text-[12px]">
                          <span className="grid size-6 place-items-center rounded-full bg-[#f1f5f9] text-[10px] font-bold text-[#475569]">{index + 1}</span>
                          <span className="truncate font-semibold text-[#111827]">{item.label}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]"><div className="h-full rounded-full bg-[#2A9D90]" style={{ width: String(percent) + "%" }} /></div>
                          <span className="text-right font-bold text-[#111827]">{formatNumber(item.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid h-[292px] place-items-center bg-[#fbfdff] text-[12px] text-[#64748b]">Aucune activite de cadenas disponible pour le moment.</div>
          )}
        </article>

        <article className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
          <div className="border-b border-[#e6edf4] px-5 py-4">
            <h2 className="text-[15px] font-bold">Etat de connexion</h2>
            <p className="mt-1 text-[12px] text-[#718096]">Disponibilite des cadenas connectes</p>
          </div>
          <div className="p-5">
            <div className="grid place-items-center rounded-[10px] bg-[#f8fafc] py-5">
              <div className="relative grid size-[152px] place-items-center rounded-full shadow-[inset_0_0_0_10px_#eef2f7]" style={{ background: "conic-gradient(#2A9D90 0 " + connection.percent * 3.6 + "deg, transparent " + connection.percent * 3.6 + "deg 360deg)" }}>
                <div className="grid size-[108px] place-items-center rounded-full border border-[#e2e8f0] bg-white shadow-sm">
                  <div className="text-center">
                    <p className="text-[30px] font-bold leading-none text-[#0f172a]">{Math.round(connection.percent)}%</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase text-[#64748b]">connectes</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[8px] border border-[#d7f3df] bg-[#f0fdf4] px-3 py-3">
                <div className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2 font-semibold text-[#047857]"><span className="size-2.5 rounded-full bg-[#34C759]" />Cadenas en ligne</span><strong className="text-[#064e3b]">{formatNumber(connection.online)}</strong></div>
              </div>
              <div className="rounded-[8px] border border-[#e2e8f0] bg-white px-3 py-3">
                <div className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2 font-semibold text-[#64748b]"><span className="size-2.5 rounded-full bg-[#cbd5e1]" />Cadenas hors ligne</span><strong className="text-[#334155]">{formatNumber(connection.offline)}</strong></div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
        <article className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
          <div className="mb-5 flex items-start justify-between">
            <div><h2 className="text-[15px] font-bold">Cartes RFID les plus utilisees</h2><p className="mt-1 text-[12px] text-[#718096]">Classement calcule depuis les donnees du serveur</p></div>
            <button type="button" className="flex h-9 items-center gap-2 rounded-[7px] bg-[#111827] px-3 text-[12px] font-medium text-white">Rapports<ChartNoAxesColumn size={14} /></button>
          </div>
          {rfidUsage.length > 0 ? (
            <div className="space-y-4">
              {rfidUsage.map((card, index) => (
                <div key={`${card.label}-${index}`} className="grid grid-cols-[34px_1fr_50px] items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-[#ecfdf5] text-[11px] font-bold text-[#047857]">#{index + 1}</span>
                  <div className="h-9 rounded-[4px] bg-[#eef4f7]"><div className="flex h-full items-center rounded-[4px] bg-[#2A9D90] px-3 text-[12px] font-medium text-white" style={{ width: String(barHeight(card.value, maxRfidUsage, 8)) + "%" }}>{card.label}</div></div>
                  <span className="text-[12px] font-medium text-[#1f2937]">{formatNumber(card.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-36 place-items-center rounded-[8px] border border-dashed border-[#dfe6ee] text-[12px] text-[#64748b]">Aucune donnee RFID disponible pour le moment.</div>
          )}
        </article>

        <article className="rounded-[8px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.03)]">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><h2 className="text-[15px] font-bold">Carte de chaleur des trajets</h2><p className="mt-1 text-[12px] text-[#718096]">Intensite des trajets calculee depuis les donnees du serveur</p></div>
            <button type="button" className="flex h-9 items-center gap-2 rounded-[7px] border border-[#dfe6ee] px-3 text-[12px] font-medium"><Globe2 size={14} />Vue globale</button>
          </div>
          <div className="rounded-[10px] border border-[#e6edf4] bg-[#fbfdff] p-4">
            {heatMapTracks.length > 0 ? (
              <div className="grid h-[220px] grid-cols-4 gap-2 sm:grid-cols-6">
                {heatMapTracks.map((item, index) => {
                  const intensity = barHeight(item.value, maxHeatMapTrack, 12);
                  return (
                    <div key={`${item.label}-${index}`} className="flex flex-col justify-end overflow-hidden rounded-[8px] border border-[#e2e8f0] bg-white">
                      <div className="grid flex-1 place-items-center px-2 text-center text-[10px] font-semibold text-[#0f172a]">{item.label}</div>
                      <div className="px-2 pb-2"><div className="h-2 rounded-full bg-[#e2e8f0]"><div className="h-full rounded-full bg-[#ef4444]" style={{ width: String(intensity) + "%" }} /></div><p className="mt-1 text-center text-[10px] text-[#64748b]">{formatNumber(item.value)}</p></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid h-[220px] place-items-center text-[12px] text-[#64748b]">Aucune donnee de trajet disponible pour le moment.</div>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-[#64748b]"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ef4444]" />Activite elevee</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#e2e8f0]" />Activite faible</span></div>
          </div>
        </article>
      </section>

      <div className="mt-5 flex flex-wrap justify-end gap-x-8 gap-y-2 pb-2 text-[11px] text-[#64748b]">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#a16207]" />Verrouilles : ({formatNumber(locked)})</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#a7f3d0]" />Deverrouilles : ({formatNumber(unlocked)})</span>
      </div>
    </div>
  );
}
