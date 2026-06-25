"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, cachedApiJson } from "../../lib/api";

type ApiRecord = Record<string, unknown>;
type LoadState = "idle" | "loading" | "ready" | "error";
type ReportStatus = "Ready" | "Processing" | "Error";
type GroupBy = "day" | "week" | "month";
type ReportKind = "alerts" | "geofences" | "unlocks" | "mileage" | "battery";

type ReportDefinition = { key: ReportKind; label: string; endpoint: string; type: string; description: string };
type DeviceOption = { id: string; name: string };
type ReportResponse = { range?: ApiRecord; filters?: ApiRecord; summary?: ApiRecord; timeline?: unknown[]; pagination?: ApiRecord; rows?: unknown[] };
type ReportsSummaryResponse = { range?: ApiRecord; filters?: ApiRecord; reports?: Partial<Record<ReportKind, ApiRecord>> };
type ReportJob = { id: string; name: string; status: ReportStatus; type: string; date: string; time: string; size: string; definition: ReportDefinition; filters: ReportFilters; response?: ReportResponse; error?: string };
type ReportFilters = { kind: ReportKind; from: string; to: string; terminalId: string; groupBy: GroupBy; page: number; limit: number; type: string; severity: string; status: string; geofenceId: string; method: string; below: string };

const reportDefinitions: ReportDefinition[] = [
  { key: "alerts", label: "Alerts Report", endpoint: "/reports/alerts", type: "Security", description: "Alert totals, unresolved and critical counts, grouped breakdowns, timeline, and detailed alerts." },
  { key: "geofences", label: "Geofence Activity Report", endpoint: "/reports/geofences", type: "Geofence", description: "Entries, exits, unlocks inside sites, affected locks, rules, configuration, and timeline." },
  { key: "unlocks", label: "Unlock Methods Report", endpoint: "/reports/unlocks", type: "Security", description: "Openings, methods, RFID/password totals, coordinates, geofences, and timelines." },
  { key: "mileage", label: "Mileage Report", endpoint: "/reports/mileage", type: "Operational", description: "Total kilometers and per-lock starting mileage, ending mileage, distance, and timestamps." },
  { key: "battery", label: "Battery Health Report", endpoint: "/reports/battery", type: "Maintenance", description: "Average, minimum, maximum, latest battery levels, low samples, charging samples, and per-lock results." },
];
const methodOptions = ["", "rfid", "static_password", "dynamic_password", "bluetooth", "other"];
const alertTypeOptions = ["", "locked", "unlock_rejected", "tamper", "geofence", "low_battery", "offline", "other"];
const severityOptions = ["", "info", "warning", "critical"];
const alertStatusOptions = ["", "unresolved", "resolved", "acknowledged"];
const rangePresetOptions = [
  { value: "last7", label: "Last 7 days", days: 7 },
  { value: "last30", label: "Last 30 days", days: 30 },
  { value: "last90", label: "Last 90 days", days: 90 },
  { value: "custom", label: "Custom range", days: 0 },
] as const;
type RangePreset = typeof rangePresetOptions[number]["value"];

function defaultFromDate() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }
function defaultToDate() { return new Date().toISOString().slice(0, 10); }
function defaultFilters(kind: ReportKind = "alerts"): ReportFilters { return { kind, from: defaultFromDate(), to: defaultToDate(), terminalId: "", groupBy: "day", page: 1, limit: 100, type: "", severity: "", status: "", geofenceId: "", method: "", below: "" }; }
function asRecord(value: unknown): ApiRecord | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : undefined; }
function rowsFromPayload(payload: unknown): unknown[] { if (Array.isArray(payload)) return payload; const r = asRecord(payload); if (!r) return []; for (const k of ["data", "items", "results", "devices", "locks", "rows"]) if (Array.isArray(r[k])) return r[k] as unknown[]; return []; }
function textValue(...values: unknown[]) { for (const v of values) { if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number" && Number.isFinite(v)) return String(v); if (typeof v === "boolean") return v ? "Yes" : "No"; } return undefined; }
function terminalIdFromRecord(record: ApiRecord) { return textValue(record.terminalId, record.terminalID, record.deviceId, record.lockId, record.id, record.imei) ?? "unknown"; }
function normalizeDevice(row: unknown, index: number): DeviceOption | null { const r = asRecord(row); if (!r) return null; const id = terminalIdFromRecord(r); if (id === "unknown") return null; return { id, name: textValue(r.name, r.assetName, r.deviceName, r.label) ?? "Device-" + index }; }
function formatValue(value: unknown): string { if (value === null || value === undefined || value === "") return "--"; if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2); if (typeof value === "boolean") return value ? "Yes" : "No"; if (typeof value === "string") return value; if (Array.isArray(value)) return value.length + " item" + (value.length === 1 ? "" : "s"); if (typeof value === "object") return JSON.stringify(value); return String(value); }
function formatLabel(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase()); }
function rowRecord(row: unknown): ApiRecord { return asRecord(row) ?? { value: row }; }
function rowColumns(rows: unknown[]) { const keys = new Set<string>(); for (const row of rows.slice(0, 20)) Object.keys(rowRecord(row)).forEach(k => keys.add(k)); return Array.from(keys).filter(k => k !== "deletedAt").slice(0, 8); }
function reportTotal(response?: ReportResponse) { const summary = response?.summary; const total = Number(response?.pagination?.total ?? summary?.total ?? summary?.totalAlerts ?? summary?.totalOpenings ?? response?.rows?.length ?? 0); return Number.isFinite(total) ? total : 0; }
function hasReportData(response?: ReportResponse) { if (!response) return false; if ((response.rows?.length ?? 0) > 0) return true; if ((response.timeline?.length ?? 0) > 0) return true; return Object.values(response.summary ?? {}).some(value => Number(value) > 0); }
function summaryTotal(summary?: ApiRecord) { if (!summary) return 0; for (const key of ["total", "totalAlerts", "totalOpenings", "totalOpened", "totalGeofences", "samples", "entries", "totalKilometers", "affectedLocks"]) { const value = Number(summary[key]); if (Number.isFinite(value) && value > 0) return value; } return 0; }
function formatSize(response?: ReportResponse) { const rowCount = Number(response?.pagination?.total ?? response?.rows?.length ?? 0); if (Number.isFinite(rowCount) && rowCount > 0) return String(rowCount) + " rows"; const total = reportTotal(response) || summaryTotal(response?.summary); return total ? String(total) + " total" : "--"; }
function timestampParts() { const d = new Date(); return { date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 8) }; }
function buildReportPath(filters: ReportFilters) { const def = reportDefinitions.find(d => d.key === filters.kind) ?? reportDefinitions[0]; const p = new URLSearchParams(); if (filters.from) p.set("from", new Date(filters.from + "T00:00:00.000Z").toISOString()); if (filters.to) p.set("to", new Date(filters.to + "T23:59:59.999Z").toISOString()); if (filters.terminalId) p.set("terminalId", filters.terminalId); p.set("groupBy", filters.groupBy); p.set("page", String(filters.page)); p.set("limit", String(filters.limit)); if (filters.kind === "alerts") { if (filters.type) p.set("type", filters.type); if (filters.severity) p.set("severity", filters.severity); if (filters.status) p.set("status", filters.status); } if ((filters.kind === "geofences" || filters.kind === "unlocks") && filters.geofenceId) p.set("geofenceId", filters.geofenceId); if (filters.kind === "unlocks" && filters.method) p.set("method", filters.method); if (filters.kind === "battery" && filters.below) p.set("below", filters.below); return def.endpoint + "?" + p.toString(); }
function buildReportsSummaryPath(filters: Pick<ReportFilters, "from" | "to" | "terminalId" | "groupBy">) { const p = new URLSearchParams(); if (filters.from) p.set("from", filters.from); if (filters.to) p.set("to", filters.to); if (filters.terminalId) p.set("terminalId", filters.terminalId); if (filters.groupBy) p.set("groupBy", filters.groupBy); return "/reports?" + p.toString(); }
function statusClass(status: ReportStatus) { if (status === "Ready") return "bg-[#eaf8ef] text-[#16883f]"; if (status === "Processing") return "bg-[#fff7d6] text-[#a16207]"; return "bg-[#feecec] text-[#ef4444]"; }
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) { return Promise.race([promise, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs))]); }

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function truncatePdfText(value: unknown, maxLength = 34) {
  const clean = formatValue(value).replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? clean.slice(0, maxLength - 1) + "..." : clean;
}

function createReportPdfBlob(report: ReportJob) {
  const response = report.response;
  const summaryEntries = Object.entries(response?.summary ?? {}).slice(0, 8);
  const rows = response?.rows ?? [];
  const columns = rowColumns(rows).slice(0, 5);
  const rgb = (r: number, g: number, b: number) => (r / 255).toFixed(3) + " " + (g / 255).toFixed(3) + " " + (b / 255).toFixed(3);
  const pageRows: unknown[][] = [];
  if (!rows.length) pageRows.push([]);
  else {
    const firstPageCount = summaryEntries.length > 4 ? 18 : 21;
    const otherPageCount = 25;
    pageRows.push(rows.slice(0, firstPageCount));
    for (let index = firstPageCount; index < rows.length; index += otherPageCount) pageRows.push(rows.slice(index, index + otherPageCount));
  }

  function renderPage(currentRows: unknown[], pageIndex: number, pageCount: number) {
    const commands: string[] = [];
    const rect = (x: number, y: number, w: number, h: number, color: [number, number, number]) => commands.push(rgb(...color) + " rg", x + " " + y + " " + w + " " + h + " re f");
    const strokeRect = (x: number, y: number, w: number, h: number, color: [number, number, number]) => commands.push(rgb(...color) + " RG", "0.8 w", x + " " + y + " " + w + " " + h + " re S");
    const textAt = (x: number, y: number, value: unknown, size = 10, color: [number, number, number] = [17, 24, 39], bold = false, maxLength = 82) => {
      commands.push("BT", rgb(...color) + " rg", (bold ? "/F2 " : "/F1 ") + size + " Tf", x + " " + y + " Td", "(" + pdfEscape(truncatePdfText(value, maxLength)) + ") Tj", "ET");
    };

    rect(0, 780, 612, 62, [10, 24, 42]);
    rect(0, 780, 8, 62, [42, 157, 144]);
    textAt(42, 815, report.name, 19, [255, 255, 255], true);
    textAt(42, 795, report.type + " - " + report.status + " - Generated " + report.date + " " + report.time, 9, [203, 213, 225]);
    textAt(458, 815, "Pad Lock", 12, [255, 255, 255], true);
    textAt(458, 798, "Reports & Analytics", 8, [203, 213, 225]);

    let tableY = 704;
    if (pageIndex === 0) {
      textAt(42, 742, "Summary", 13, [17, 24, 39], true);
      const cards: [string, unknown][] = summaryEntries.length ? summaryEntries : [["total", reportTotal(response)]];
      cards.slice(0, 8).forEach(([key, value], index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = 42 + col * 132;
        const y = 682 - row * 64;
        rect(x, y, 118, 48, index % 2 ? [248, 250, 252] : [239, 253, 250]);
        strokeRect(x, y, 118, 48, [223, 230, 238]);
        textAt(x + 10, y + 30, formatLabel(key), 7, [100, 116, 139], true, 22);
        textAt(x + 10, y + 12, formatValue(value), 14, [15, 23, 42], true, 18);
      });
      tableY = summaryEntries.length > 4 ? 540 : 604;
    }

    textAt(42, tableY + 32, pageIndex === 0 ? "Detail Rows" : "Detail Rows Continued", 13, [17, 24, 39], true);
    if (!rows.length || !columns.length) {
      rect(42, tableY - 12, 528, 46, [248, 250, 252]);
      strokeRect(42, tableY - 12, 528, 46, [223, 230, 238]);
      textAt(58, tableY + 8, "No detail rows returned from the backend for these filters.", 10, [100, 116, 139]);
    } else {
      const widths = [110, 104, 104, 104, 104];
      const xs = [42, 152, 256, 360, 464];
      rect(42, tableY, 528, 24, [30, 41, 59]);
      columns.forEach((column, index) => textAt(xs[index] + 8, tableY + 8, formatLabel(column), 8, [255, 255, 255], true, 16));
      currentRows.forEach((row, rowIndex) => {
        const y = tableY - 24 - rowIndex * 24;
        const record = rowRecord(row);
        rect(42, y, 528, 24, rowIndex % 2 ? [255, 255, 255] : [248, 250, 252]);
        strokeRect(42, y, 528, 24, [226, 232, 240]);
        columns.forEach((column, index) => textAt(xs[index] + 8, y + 8, record[column], 7.5, [51, 65, 85], false, widths[index] > 108 ? 18 : 16));
      });
    }

    const filterLine = "Rows " + (rows.length ? (pageIndex === 0 ? 1 : pageRows.slice(0, pageIndex).reduce((total, group) => total + group.length, 0) + 1) : 0) + "-" + pageRows.slice(0, pageIndex + 1).reduce((total, group) => total + group.length, 0) + " of " + rows.length;
    rect(42, 48, 528, 1, [226, 232, 240]);
    textAt(42, 28, filterLine, 7, [100, 116, 139]);
    textAt(500, 28, "Page " + (pageIndex + 1) + " of " + pageCount, 7, [100, 116, 139]);
    return commands.join("\n");
  }

  const streams = pageRows.map((group, index) => renderPage(group, index, pageRows.length));
  const font1Ref = 3 + streams.length * 2;
  const font2Ref = font1Ref + 1;
  const pageRefs = streams.map((_, index) => 3 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [" + pageRefs.map(ref => ref + " 0 R").join(" ") + "] /Count " + streams.length + " >>",
  ];
  streams.forEach((content, index) => {
    const pageRef = 3 + index * 2;
    const contentRef = pageRef + 1;
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 " + font1Ref + " 0 R /F2 " + font2Ref + " 0 R >> >> /Contents " + contentRef + " 0 R >>");
    objects.push("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += String(index + 1) + " 0 obj\n" + object + "\nendobj\n";
  });
  const xref = pdf.length;
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => { pdf += String(offset).padStart(10, "0") + " 00000 n \n"; });
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return new Blob([pdf], { type: "application/pdf" });
}

function datesForRangePreset(preset: RangePreset) {
  const option = rangePresetOptions.find(item => item.value === preset) ?? rangePresetOptions[1];
  if (option.value === "custom") return null;
  const from = new Date();
  from.setDate(from.getDate() - option.days);
  return { from: from.toISOString().slice(0, 10), to: defaultToDate() };
}

function GenerateReportModal({ filters, devices, loading, onClose, onGenerate }: { filters: ReportFilters; devices: DeviceOption[]; loading: boolean; onClose: () => void; onGenerate: (filters: ReportFilters) => void }) {
  const [draft, setDraft] = useState(filters);
  const [rangePreset, setRangePreset] = useState<RangePreset>("last30");
  const definition = reportDefinitions.find(d => d.key === draft.kind) ?? reportDefinitions[0];
  const isCustomRange = rangePreset === "custom";
  function update(next: Partial<ReportFilters>) { setDraft(current => ({ ...current, ...next, page: 1 })); }
  function chooseRange(nextPreset: RangePreset) { const dates = datesForRangePreset(nextPreset); setRangePreset(nextPreset); if (dates) update(dates); }
  function updateDate(next: Partial<Pick<ReportFilters, "from" | "to">>) { setRangePreset("custom"); update(next); }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/55 px-4 backdrop-blur-[5px]">
      <div className="w-full max-w-[430px] rounded-[9px] border border-[#dfe6ee] bg-white p-5 shadow-xl">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="text-[16px] font-bold">Generate New Report</h2><p className="mt-1 text-[12px] text-[#64748b]">Configure and generate custom reports</p></div><button type="button" onClick={onClose} aria-label="Close modal"><X size={18} /></button></div>
        <div className="space-y-4">
          <label className="block text-[12px] font-medium">Report Type <span className="text-[#ef4444]">*</span><select value={draft.kind} onChange={e => update({ kind: e.target.value as ReportKind, type: "", severity: "", status: "", geofenceId: "", method: "", below: "" })} className="mt-2 h-9 w-full rounded-[6px] border border-[#dfe6ee] px-3 outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15">{reportDefinitions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <div className="block text-[12px] font-medium"><span>Date Range <span className="text-[#ef4444]">*</span></span><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_112px_112px]"><select value={rangePreset} onChange={e => chooseRange(e.target.value as RangePreset)} className="h-9 w-full rounded-[6px] border border-[#dfe6ee] px-3 outline-none">{rangePresetOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input value={draft.from} onChange={e => updateDate({ from: e.target.value })} disabled={!isCustomRange} type="date" className="h-9 w-full rounded-[6px] border border-[#dfe6ee] px-2 text-[11px] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]" /><input value={draft.to} onChange={e => updateDate({ to: e.target.value })} disabled={!isCustomRange} type="date" className="h-9 w-full rounded-[6px] border border-[#dfe6ee] px-2 text-[11px] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]" /></div></div>
          <label className="block text-[12px] font-medium">Group By<select value={draft.groupBy} onChange={e => update({ groupBy: e.target.value as GroupBy })} className="mt-2 h-9 w-full rounded-[6px] border border-[#dfe6ee] px-3 outline-none"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
          <div className="border-t border-[#dfe6ee] pt-4"><p className="text-[12px] font-medium">Asset selection</p><p className="mt-1 text-[11px] text-[#64748b]">Select Assets to include</p></div>
          <label className="block text-[12px] font-medium">Select Device <span className="text-[#ef4444]">*</span><select value={draft.terminalId} onChange={e => update({ terminalId: e.target.value })} className="mt-2 h-9 w-full rounded-[6px] border border-[#dfe6ee] px-3 outline-none"><option value="">All devices</option>{devices.map(device => <option key={device.id} value={device.id}>{device.name} - {device.id}</option>)}</select></label>
          {draft.kind === "alerts" ? <div className="grid grid-cols-3 gap-2"><select value={draft.type} onChange={e => update({ type: e.target.value })} className="h-9 rounded-[6px] border border-[#dfe6ee] px-2 text-[11px]">{alertTypeOptions.map(item => <option key={item} value={item}>{item || "All types"}</option>)}</select><select value={draft.severity} onChange={e => update({ severity: e.target.value })} className="h-9 rounded-[6px] border border-[#dfe6ee] px-2 text-[11px]">{severityOptions.map(item => <option key={item} value={item}>{item || "All severities"}</option>)}</select><select value={draft.status} onChange={e => update({ status: e.target.value })} className="h-9 rounded-[6px] border border-[#dfe6ee] px-2 text-[11px]">{alertStatusOptions.map(item => <option key={item} value={item}>{item || "All statuses"}</option>)}</select></div> : null}
          {draft.kind === "unlocks" ? <select value={draft.method} onChange={e => update({ method: e.target.value })} className="h-9 w-full rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]">{methodOptions.map(method => <option key={method} value={method}>{method || "All methods"}</option>)}</select> : null}
          <label className="block text-[12px] font-medium">Output Format<select value="PDF" disabled className="mt-2 h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-[#f8fafc] px-3 outline-none"><option>PDF</option></select></label>
          <div className="flex gap-3 rounded-[7px] bg-[#f7f7f8] p-4"><span className="grid size-8 shrink-0 place-items-center rounded-[5px] bg-[#050505] text-white"><FileText size={16} /></span><div><h3 className="text-[15px] font-medium">{definition.label} Includes:</h3><p className="mt-2 text-[11px] leading-snug text-[#64748b]">{definition.description}</p></div></div>
        </div>
        <div className="mt-5 flex justify-between"><button type="button" onClick={onClose} className="h-9 rounded-[6px] border border-[#dfe6ee] bg-white px-4 text-[12px] font-medium">Cancel</button><button type="button" onClick={() => onGenerate(draft)} disabled={loading} className="flex h-9 items-center gap-2 rounded-[6px] bg-[#111111] px-4 text-[12px] font-semibold text-white disabled:opacity-60">{loading ? <Loader2 size={14} className="animate-spin" /> : null}Generate Report</button></div>
      </div>
    </div>
  );
}

function ViewReportModal({ report, onClose }: { report: ReportJob; onClose: () => void }) {
  const rows = report.response?.rows ?? [];
  const columns = rowColumns(rows);
  const summary = Object.entries(report.response?.summary ?? {}).slice(0, 8);
  const totalRows = Number(report.response?.pagination?.total ?? rows.length);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/55 px-4 backdrop-blur-[5px]">
      <div className="max-h-[86vh] w-full max-w-[920px] overflow-hidden rounded-[9px] border border-[#dfe6ee] bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-[#dfe6ee] px-5 py-4"><div><h2 className="text-[17px] font-bold">{report.name}</h2><p className="mt-1 text-[12px] text-[#64748b]">{report.date} {report.time} - {report.type} - Showing {rows.length} of {Number.isFinite(totalRows) ? totalRows : rows.length} rows</p></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        <div className="max-h-[calc(86vh-72px)] overflow-auto p-5">
          {summary.length ? <div className="mb-4 grid gap-3 md:grid-cols-4">{summary.map(([key, value]) => <div key={key} className="rounded-[7px] border border-[#dfe6ee] px-3 py-3"><p className="text-[10px] font-bold uppercase text-[#64748b]">{formatLabel(key)}</p><p className="mt-2 truncate text-[18px] font-bold">{formatValue(value)}</p></div>)}</div> : null}
          <div className="overflow-hidden rounded-[7px] border border-[#dfe6ee]"><div className="overflow-x-auto"><table className="min-w-full text-left text-[12px]"><thead className="bg-[#fbfdff] text-[#496383]"><tr>{columns.map(column => <th key={column} className="whitespace-nowrap px-3 py-3 font-bold">{formatLabel(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => { const record = rowRecord(row); return <tr key={index} className="border-t border-[#edf2f7]">{columns.map(column => <td key={column} className="max-w-[220px] truncate px-3 py-3">{formatValue(record[column])}</td>)}</tr>; })}</tbody></table></div>{!rows.length ? <div className="grid h-32 place-items-center text-[12px] text-[#64748b]">No detail rows returned.</div> : null}</div>
        </div>
      </div>
    </div>
  );
}

function Pager({ selectedCount, page, pageCount, rowsPerPage, onRowsPerPage, onPage }: { selectedCount: number; page: number; pageCount: number; rowsPerPage: number; onRowsPerPage: (value: number) => void; onPage: (value: number) => void }) {
  return <div className="flex items-center justify-between py-4 text-[12px] text-[#64748b]"><span>{selectedCount} row(s) selected.</span><div className="flex items-center gap-4"><span className="font-semibold text-[#111827]">Rows per page</span><select value={rowsPerPage} onChange={e => onRowsPerPage(Number(e.target.value))} className="h-8 rounded-[6px] border border-[#dfe6ee] bg-white px-3"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select><span className="font-semibold text-[#111827]">Page {page} of {pageCount}</span><div className="flex gap-2">{[{Icon:ChevronsLeft,p:1},{Icon:ChevronLeft,p:Math.max(1,page-1)},{Icon:ChevronRight,p:Math.min(pageCount,page+1)},{Icon:ChevronsRight,p:pageCount}].map(({Icon,p},i)=><button key={i} type="button" onClick={()=>onPage(p)} disabled={p===page} className="grid size-8 place-items-center rounded-[6px] bg-white text-[#94a3b8] disabled:opacity-40"><Icon size={14}/></button>)}</div></div></div>;
}

export function ReportsPanel() {
  const [reports, setReports] = useState<ReportJob[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [query, setQuery] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState("All");
  const [lockFilter, setLockFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewReport, setViewReport] = useState<ReportJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { void loadDevices(); }, []);
  useEffect(() => { void loadDefaultReports(lockFilter === "All" ? "" : lockFilter); }, [lockFilter]);
  useEffect(() => setPage(1), [query, reportTypeFilter, lockFilter, rowsPerPage]);

  async function loadDevices() { const [d,l] = await Promise.all([cachedApiJson("/devices", true).catch(()=>[]), cachedApiJson("/locks", true).catch(()=>[])]); const rows = rowsFromPayload(d).length ? rowsFromPayload(d) : rowsFromPayload(l); setDevices(rows.map(normalizeDevice).filter((x): x is DeviceOption => Boolean(x))); }
  async function fetchReportsSummary(filters: Pick<ReportFilters, "from" | "to" | "terminalId" | "groupBy">) { const res = await withTimeout(apiFetch(buildReportsSummaryPath(filters), { cache: "no-store" }), 9000, "Reports summary timed out"); const payload = await res.json().catch(()=>null) as ReportsSummaryResponse | { message?: string | string[]; error?: string } | null; if (!res.ok) { const raw = payload && "message" in payload ? payload.message : payload && "error" in payload ? payload.error : undefined; const detail = Array.isArray(raw) ? raw.join(" ") : textValue(raw) ?? "Reports summary request failed."; throw new Error(detail); } return payload as ReportsSummaryResponse; }
  async function fetchReportPath(path: string, timeoutMs = 9000) { const res = await withTimeout(apiFetch(path, { cache: "no-store" }), timeoutMs, "Report request timed out"); const payload = await res.json().catch(()=>null) as ReportResponse | { message?: string | string[]; error?: string; statusCode?: number } | null; if (!res.ok) { const raw = payload && "message" in payload ? payload.message : payload && "error" in payload ? payload.error : undefined; const detail = Array.isArray(raw) ? raw.join(" ") : textValue(raw) ?? "Report request failed."; throw new Error(detail + " (" + path + ")"); } return payload as ReportResponse; }
  function relaxedReportFilters(filters: ReportFilters) { const retry = { ...filters, terminalId: "", type: "", severity: "", status: "", geofenceId: "", method: "", below: filters.kind === "battery" ? "" : filters.below, page: 1, limit: Math.min(Math.max(filters.limit, 100), 100) }; const from = new Date(); from.setDate(from.getDate() - (filters.kind === "unlocks" ? 180 : 90)); retry.from = from.toISOString().slice(0, 10); retry.to = defaultToDate(); return retry; }
  function minimalReportPath(filters: ReportFilters) { const def = reportDefinitions.find(d => d.key === filters.kind) ?? reportDefinitions[0]; const p = new URLSearchParams(); const from = new Date(); from.setDate(from.getDate() - (filters.kind === "unlocks" ? 180 : 90)); p.set("from", new Date(from.toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString()); p.set("to", new Date(defaultToDate() + "T23:59:59.999Z").toISOString()); p.set("page", "1"); p.set("limit", "100"); return def.endpoint + "?" + p.toString(); }
  function reportRequestPaths(filters: ReportFilters, allowFallbacks = true) { if (!allowFallbacks) return [buildReportPath(filters)]; const relaxed = relaxedReportFilters(filters); return Array.from(new Set([buildReportPath(filters), buildReportPath(relaxed), minimalReportPath(filters)])); }
  function pathWithPage(path: string, page: number) { const [base, query = ""] = path.split("?"); const params = new URLSearchParams(query); params.set("page", String(page)); params.set("limit", "100"); return base + "?" + params.toString(); }
  async function fetchAllReportPages(path: string, first: ReportResponse) { const total = Number(first.pagination?.total ?? first.rows?.length ?? 0); const firstRows = first.rows ?? []; const limit = Math.max(1, Number(first.pagination?.limit ?? 100)); const pageCount = Math.ceil(total / limit); if (!Number.isFinite(total) || pageCount <= 1 || firstRows.length >= total) return first; const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => fetchReportPath(pathWithPage(path, index + 2)).catch(() => undefined))); const rows = [...firstRows, ...rest.flatMap(response => response?.rows ?? [])].slice(0, total || undefined); return { ...first, rows, pagination: { ...first.pagination, page: 1, limit, total } }; }
  async function fetchReport(filters: ReportFilters, includeAllPages = true, allowFallbacks = true) { let emptyResponse: ReportResponse | undefined; let lastError: Error | undefined; for (const path of reportRequestPaths(filters, allowFallbacks)) { try { const firstPage = await fetchReportPath(path); const response = includeAllPages ? await fetchAllReportPages(path, firstPage) : firstPage; if (hasReportData(response)) return response; emptyResponse = emptyResponse ?? response; } catch (error) { lastError = error instanceof Error ? error : new Error("Report request failed."); } } if (emptyResponse) return emptyResponse; throw lastError ?? new Error("Report request failed."); }
  function jobFrom(definition: ReportDefinition, filters: ReportFilters, response?: ReportResponse, error?: string): ReportJob { const time = timestampParts(); return { id: definition.key + "-" + Date.now() + "-" + Math.random().toString(36).slice(2), name: definition.label, status: error ? "Error" : response ? "Ready" : "Processing", type: definition.type, date: time.date, time: time.time, size: response ? formatSize(response) : "--", definition, filters, response, error }; }
  async function loadDefaultReports(nextTerminalId = lockFilter === "All" ? "" : lockFilter) { setLoading(true); setMessage("Loading report history..."); const baseFilters = { ...defaultFilters(), terminalId: nextTerminalId }; const baseJobs = reportDefinitions.map(definition => jobFrom(definition, { ...baseFilters, kind: definition.key })); setReports(baseJobs); try { const summaryPayload = await fetchReportsSummary(baseFilters); const jobs = reportDefinitions.map(definition => { const filters = { ...baseFilters, kind: definition.key }; const summary = summaryPayload.reports?.[definition.key] ?? {}; const response: ReportResponse = { range: summaryPayload.range, filters: summaryPayload.filters, summary, rows: [], timeline: [] }; return jobFrom(definition, filters, response); }); setReports(jobs); setMessage("Historique des rapports"); } catch (error) { setReports(baseJobs.map(job => ({ ...job, status: "Error" as ReportStatus, error: error instanceof Error ? error.message : "Failed", size: "--" }))); setMessage(error instanceof Error ? error.message : "Could not load report history."); } finally { setLoading(false); } }
  async function generateReport(filters: ReportFilters) { const definition = reportDefinitions.find(d => d.key === filters.kind) ?? reportDefinitions[0]; setLoading(true); setMessage("Generating report..."); const pending = jobFrom(definition, filters); setReports(current => [pending, ...current]); try { const response = await fetchReport(filters); setReports(current => current.map(item => item.id === pending.id ? { ...item, status: "Ready", response, size: formatSize(response), date: timestampParts().date, time: timestampParts().time } : item)); setShowModal(false); setMessage("Report generated."); } catch (error) { setReports(current => current.map(item => item.id === pending.id ? { ...item, status: "Error", error: error instanceof Error ? error.message : "Failed", size: "--" } : item)); setMessage(error instanceof Error ? error.message : "Could not generate report."); } finally { setLoading(false); } }
  function deleteReport(id: string) { setReports(current => current.filter(item => item.id !== id)); setSelectedIds(current => current.filter(item => item !== id)); setOpenMenuId(null); }
  function hasDetailedReport(report: ReportJob) { return Boolean((report.response?.rows?.length ?? 0) > 0 || (report.response?.timeline?.length ?? 0) > 0); }
  async function loadReportDetails(report: ReportJob) { if (hasDetailedReport(report)) return report; setLoading(true); setMessage("Loading report details..."); try { const response = await fetchReport(report.filters); const detailed = { ...report, status: "Ready" as ReportStatus, response, size: formatSize(response), error: undefined }; setReports(current => current.map(item => item.id === report.id ? detailed : item)); return detailed; } finally { setLoading(false); } }
  async function openReport(report: ReportJob) { setOpenMenuId(null); try { setViewReport(await loadReportDetails(report)); setMessage("Historique des rapports"); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load report details."); } }
  async function downloadReport(report: ReportJob) { try { const detailed = await loadReportDetails(report); const blob = createReportPdfBlob(detailed); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = detailed.name.replace(/[^a-z0-9-_]+/gi, "_") + ".pdf"; link.click(); URL.revokeObjectURL(url); setOpenMenuId(null); setMessage("Historique des rapports"); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not download report."); } }
  const filteredReports = useMemo(() => reports.filter(report => { const matchesQuery = (report.name + " " + report.type + " " + report.status).toLowerCase().includes(query.toLowerCase()); const matchesType = reportTypeFilter === "All" || report.definition.key === reportTypeFilter; const matchesLock = lockFilter === "All" || report.filters.terminalId === lockFilter; return matchesQuery && matchesType && matchesLock; }), [reports, query, reportTypeFilter, lockFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredReports.length / rowsPerPage)); const pagedReports = filteredReports.slice((page - 1) * rowsPerPage, page * rowsPerPage); const allSelected = pagedReports.length > 0 && pagedReports.every(report => selectedIds.includes(report.id));
  function toggleSelected(id: string) { setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function toggleAll() { setSelectedIds(current => allSelected ? current.filter(id => !pagedReports.some(report => report.id === id)) : Array.from(new Set([...current, ...pagedReports.map(report => report.id)]))); }

  return (
    <div className="w-full px-4 py-7 md:px-6">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><h1 className="text-[26px] font-bold tracking-normal text-black">Reports & Analytics</h1><p className="mt-2 text-[13px] text-[#64748b]">Access and download historical data and performance insights.</p></div><button type="button" onClick={() => setShowModal(true)} className="flex h-9 w-fit items-center gap-2 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white"><FileText size={14} />Generate report</button></div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex flex-col gap-3 md:flex-row md:flex-wrap"><label className="relative block w-full md:w-[300px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} /><input value={query} onChange={e => setQuery(e.target.value)} className="h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15" placeholder="Search report" /></label><label className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"><SlidersHorizontal size={14} /><select value={reportTypeFilter} onChange={e => setReportTypeFilter(e.target.value)} className="bg-transparent outline-none"><option value="All">All report types</option>{reportDefinitions.map(definition => <option key={definition.key} value={definition.key}>{definition.label}</option>)}</select></label><label className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"><select value={lockFilter} onChange={e => setLockFilter(e.target.value)} className="bg-transparent outline-none"><option value="All">All locks</option>{devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label></div><div className="flex gap-2"><button type="button" onClick={() => void loadDefaultReports(lockFilter === "All" ? "" : lockFilter)} className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold">{loading ? <Loader2 size={14} className="animate-spin" /> : null}Refresh</button><button type="button" onClick={() => { const report = reports.find(r => r.id === selectedIds[0]); if (report) void downloadReport(report); }} className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"><Upload size={14} />Export</button></div></div>
      {message ? <p className="mb-4 rounded-[7px] bg-[#f8fafc] px-3 py-2 text-[12px] text-[#64748b]">{message}</p> : null}
      <div className="overflow-visible rounded-[7px] border border-[#dfe6ee] bg-white"><div className="grid grid-cols-[48px_2fr_1fr_1fr_1.3fr_1fr_70px] border-b border-[#dfe6ee] px-4 py-3 text-[12px] font-medium text-[#496383]"><input checked={allSelected} onChange={toggleAll} type="checkbox" aria-label="Select all reports" /><span>Report Name</span><span>Status</span><span>Type</span><span>Date Generated</span><span>File Size</span><span>Actions</span></div>
        {loading && reports.length === 0 ? <div className="grid h-44 place-items-center text-[13px] font-medium text-[#64748b]"><span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading reports...</span></div> : null}
        {pagedReports.map((report, index) => <div key={report.id} className={("relative grid grid-cols-[48px_2fr_1fr_1fr_1.3fr_1fr_70px] items-center border-b border-[#dfe6ee] px-4 py-4 text-[12px] " + (index === 1 ? "bg-[#f1f1f2]" : "bg-white"))}><input checked={selectedIds.includes(report.id)} onChange={() => toggleSelected(report.id)} type="checkbox" aria-label={"Select " + report.name} /><span><span className="font-medium">{report.name}</span>{report.error ? <span className="mt-1 block max-w-[320px] truncate text-[11px] text-[#ef4444]" title={report.error}>{report.error}</span> : null}</span><span><span className={"rounded-[5px] px-2 py-1 text-[11px] font-medium " + statusClass(report.status)}>{report.status}</span></span><span>{report.type}</span><span>{report.date}<br /><span className="text-[#64748b]">{report.time}</span></span><span>{report.size}</span><button type="button" onClick={() => setOpenMenuId(openMenuId === report.id ? null : report.id)} className="grid size-7 place-items-center rounded-[5px] hover:bg-[#eef4fa]" aria-label={"Open actions for " + report.name}><Ellipsis size={16} /></button>{openMenuId === report.id ? <div className="absolute right-8 top-10 z-10 w-[132px] overflow-hidden rounded-[6px] border border-[#dfe6ee] bg-white py-1 text-[12px] shadow-lg"><button type="button" onClick={() => void openReport(report)} className="flex h-8 w-full items-center gap-2 px-3 text-left hover:bg-[#eef4fa]"><Eye size={13} />View</button><button type="button" onClick={() => void downloadReport(report)} className="flex h-8 w-full items-center gap-2 px-3 text-left hover:bg-[#eef4fa]"><Download size={13} />Download</button><button type="button" onClick={() => deleteReport(report.id)} className="flex h-8 w-full items-center gap-2 px-3 text-left text-red-700 hover:bg-red-50"><Trash2 size={13} />Delete</button></div> : null}</div>)}
        {!loading && pagedReports.length === 0 ? <div className="grid h-44 place-items-center text-[13px] font-medium text-[#64748b]">No reports match your filters.</div> : null}
      </div>
      <Pager selectedCount={selectedIds.length} page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} onRowsPerPage={setRowsPerPage} onPage={setPage} />
      <div className="flex flex-wrap justify-between gap-3 px-3 py-7 text-[11px] text-[#64748b]"><div className="flex flex-wrap gap-x-5 gap-y-2"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#34C759]" />All ({reports.length})</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#16883f]" />Ready ({reports.filter(r => r.status === "Ready").length})</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#f59e0b]" />Processing ({reports.filter(r => r.status === "Processing").length})</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ef4444]" />Error ({reports.filter(r => r.status === "Error").length})</span></div></div>
      {showModal ? <GenerateReportModal filters={defaultFilters()} devices={devices} loading={loading} onClose={() => setShowModal(false)} onGenerate={generateReport} /> : null}
      {viewReport ? <ViewReportModal report={viewReport} onClose={() => setViewReport(null)} /> : null}
    </div>
  );
}
