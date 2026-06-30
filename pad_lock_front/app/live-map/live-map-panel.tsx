"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, Search, X } from "lucide-react";
import { AssetCard } from "./asset-card";
import { LIVE_MAP_COLORS, type LiveMapAsset, type LiveMapLockState, type LiveMapPlaybackPoint, type LiveMapStatus } from "./live-map-data";
import { LiveMapShell } from "./live-map-shell";
import { apiFetch, cachedApiJson } from "../../lib/api";
import { userFriendlyError } from "../../lib/error-messages";

type ApiRecord = Record<string, unknown>;
type AssetFilter = "all" | "moving" | "idle" | "alarm" | "offline" | "locked" | "unlocked";

function rowsFromPayload(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is ApiRecord => Boolean(row) && typeof row === "object");
  }

  if (payload && typeof payload === "object") {
    const record = payload as ApiRecord;

    for (const key of ["data", "items", "results", "devices", "locks", "alerts", "positions", "history", "records", "rows"]) {
      const value = record[key];

      if (Array.isArray(value)) {
        return value.filter((row): row is ApiRecord => Boolean(row) && typeof row === "object");
      }
    }
  }

  return [];
}

function nestedRecord(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as ApiRecord;
    }
  }

  return null;
}

function readString(record: ApiRecord | null | undefined, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function readNumber(record: ApiRecord | null | undefined, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return undefined;
}

function readBoolean(record: ApiRecord | null | undefined, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.toLowerCase();

      if (["true", "locked", "online", "moving"].includes(normalized)) {
        return true;
      }

      if (["false", "unlocked", "offline", "idle"].includes(normalized)) {
        return false;
      }
    }
  }

  return undefined;
}

function deviceContainers(record: ApiRecord | null | undefined) {
  if (!record) {
    return [];
  }

  const nestedKeys = ["position", "lastPosition", "latestPosition", "telemetry", "status", "device", "lock", "data"];
  const containers: ApiRecord[] = [record];

  for (const key of nestedKeys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      containers.push(value as ApiRecord);
    }
  }

  return containers;
}

function readNestedString(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of deviceContainers(record)) {
    const value = readString(source, keys);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function readNestedNumber(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of deviceContainers(record)) {
    const value = readNumber(source, keys);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readNestedBoolean(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of deviceContainers(record)) {
    const value = readBoolean(source, keys);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function positionFromPair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2 || Array.isArray(value[0]) || Array.isArray(value[1])) {
    return undefined;
  }

  const first = Number(value[0]);
  const second = Number(value[1]);

  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return undefined;
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return [first, second];
  }

  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) {
    return [second, first];
  }

  return undefined;
}

function extractPosition(record: ApiRecord): [number, number] | undefined {
  const directPair = positionFromPair(record);

  if (directPair) {
    return directPair;
  }

  const containers: ApiRecord[] = [record];
  const nestedKeys = [
    "position",
    "lastPosition",
    "latestPosition",
    "location",
    "gps",
    "coordinates",
    "coord",
    "coords",
    "point",
    "payload",
    "data",
    "telemetry",
  ];

  for (const key of nestedKeys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      containers.push(value as ApiRecord);
    }
  }

  for (const source of containers) {
    const lat = readNumber(source, ["lat", "latitude", "gpsLat", "gpsLatitude", "y"]);
    const lng = readNumber(source, ["lng", "lon", "long", "longitude", "gpsLng", "gpsLon", "gpsLongitude", "x"]);

    if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return [lat, lng];
    }

    for (const key of ["coordinates", "coords", "position", "location", "gps"]) {
      const coords = source[key];

      const position = positionFromPair(coords);

      if (position) {
        return position;
      }
    }
  }

  return undefined;
}

function extractPlaceName(record: ApiRecord) {
  const containers: ApiRecord[] = [record];
  for (const key of ["position", "lastPosition", "latestPosition", "location", "address", "gps", "data", "telemetry"]) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) containers.push(value as ApiRecord);
  }

  for (const source of containers) {
    const direct = readString(source, ["placeName", "place", "address", "formattedAddress", "locationName", "lieu", "city", "region", "area", "site", "zone"]);
    if (direct && !/^[-0-9.,\s]+$/.test(direct)) return direct;
  }

  return undefined;
}

function formatDeviceValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  return undefined;
}

function readDeviceDetailValue(record: ApiRecord, keys: string[]) {
  const containers = [
    record,
    nestedRecord(record, ["position", "lastPosition", "latestPosition", "telemetry", "status", "device", "lock", "data"]),
  ].filter(Boolean) as ApiRecord[];

  for (const source of containers) {
    for (const key of keys) {
      const value = formatDeviceValue(source[key]);

      if (value) {
        return { key, value };
      }
    }
  }

  return null;
}

function formatBatteryDetail(value: string) {
  if (value.endsWith("%") || !Number.isFinite(Number(value))) {
    return value;
  }

  return `${Math.max(0, Math.min(100, Math.round(Number(value))))}%`;
}

function buildDeviceDetails(record: ApiRecord, lock?: ApiRecord) {
  const details: { label: string; value: string }[] = [];
  const usedKeys = new Set<string>(["lat", "latitude", "lng", "lon", "long", "longitude", "gpsLat", "gpsLatitude", "gpsLng", "gpsLon", "gpsLongitude", "x", "y", "coordinates", "coords"]);
  const locationName = extractPlaceName(record) ?? (lock ? extractPlaceName(lock) : undefined);

  if (locationName) {
    details.push({ label: "Location", value: locationName });
  }
  const preferredFields: { label: string; keys: string[] }[] = [
    { label: "Terminal ID", keys: ["terminalId", "terminalID", "deviceId", "lockId", "id"] },
    { label: "Device", keys: ["name", "assetName", "deviceName", "label"] },
    { label: "Status", keys: ["status", "state", "movementStatus", "motion"] },
    { label: "Battery", keys: ["battery", "batteryLevel", "power", "batteryPercent"] },
    { label: "Locked", keys: ["locked", "isLocked", "lockState", "statusLock"] },
    { label: "Online", keys: ["online", "isOnline", "connected"] },
    { label: "Speed", keys: ["speed", "speedKph", "velocity"] },
  ];

  for (const field of preferredFields) {
    const detail = readDeviceDetailValue(record, field.keys);

    if (detail) {
      details.push({
        label: field.label,
        value: field.label === "Battery" ? formatBatteryDetail(detail.value) : detail.value,
      });
      field.keys.forEach((fieldKey) => usedKeys.add(fieldKey));
    }
  }

  for (const [key, rawValue] of Object.entries(record)) {
    if (details.length >= 12 || usedKeys.has(key)) {
      continue;
    }

    const value = formatDeviceValue(rawValue);

    if (value) {
      details.push({
        label: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
        value,
      });
    }
  }

  return details;
}

function getTerminalId(record: ApiRecord) {
  return readString(record, ["terminalId", "terminalID", "deviceId", "lockId", "id", "serial", "imei"]) ?? "unknown";
}

function keyByTerminal(rows: ApiRecord[]) {
  return new Map(rows.map((row) => [getTerminalId(row), row]));
}

function alertTerminalId(alert: ApiRecord) {
  return readString(alert, ["terminalId", "deviceId", "lockId", "assetId"]);
}

function hasActiveAlert(terminalId: string, alerts: ApiRecord[]) {
  return alerts.some((alert) => {
    const status = readString(alert, ["status", "state"])?.toLowerCase();
    return alertTerminalId(alert) === terminalId && !["read", "resolved", "closed"].includes(status ?? "");
  });
}

function normalizeBattery(record: ApiRecord, lock?: ApiRecord) {
  const raw = readNestedString(record, ["battery", "batteryLevel", "power", "batteryPercent"])
    ?? readNestedString(lock, ["battery", "batteryLevel", "power", "batteryPercent"]);

  if (raw) {
    const match = raw.match(/\d+(?:\.\d+)?/);

    if (match) {
      return `${Math.max(0, Math.min(100, Math.round(Number(match[0]))))}%`;
    }
  }

  const value = readNestedNumber(record, ["battery", "batteryLevel", "power", "batteryPercent"])
    ?? readNestedNumber(lock, ["battery", "batteryLevel", "power", "batteryPercent"]);

  if (value === undefined) {
    return "--";
  }

  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function normalizeSignal(record: ApiRecord, lock?: ApiRecord) {
  const raw = readNestedString(record, ["signal", "signalQuality", "networkQuality", "quality"])
    ?? readNestedString(lock, ["signal", "signalQuality", "networkQuality", "quality"]);

  if (raw) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }

  const value = readNestedNumber(record, ["rssi", "signalStrength"])
    ?? readNestedNumber(lock, ["rssi", "signalStrength"]);

  if (value === undefined) {
    return "Inconnu";
  }

  return value >= 70 ? "Excellent" : value >= 40 ? "Moyen" : "Faible";
}

function normalizeLockState(record: ApiRecord, lock?: ApiRecord): LiveMapLockState {
  const raw = readNestedString(record, ["lock", "lockState", "locked", "statusLock"])
    ?? readNestedString(lock, ["lock", "lockState", "locked", "statusLock"]);
  const bool = readNestedBoolean(record, ["locked", "isLocked"])
    ?? readNestedBoolean(lock, ["locked", "isLocked"]);

  if (bool === true || raw?.toLowerCase() === "locked") {
    return "Locked";
  }

  if (bool === false || raw?.toLowerCase() === "unlocked") {
    return "Unlocked";
  }

  return "Unknown";
}

function normalizeStatus(record: ApiRecord, activeAlert: boolean): LiveMapStatus {
  if (activeAlert) {
    return "Alarm";
  }

  const raw = readString(record, ["status", "state", "movementStatus", "motion", "online"]);
  const online = readBoolean(record, ["online", "isOnline", "connected"]);

  if (raw) {
    const status = raw.toLowerCase();

    if (status.includes("alarm") || status.includes("alert")) {
      return "Alarm";
    }

    if (status.includes("moving") || status.includes("motion")) {
      return "Moving";
    }

    if (status.includes("idle") || status.includes("stopped")) {
      return "Idle";
    }

    if (status.includes("offline") || status.includes("disconnected")) {
      return "Offline";
    }
  }

  if (online === false) {
    return "Offline";
  }

  return "Moving";
}

function normalizeAsset(record: ApiRecord, locksByTerminal: Map<string, ApiRecord>, alerts: ApiRecord[]): LiveMapAsset {
  const terminalId = getTerminalId(record);
  const lock = locksByTerminal.get(terminalId);
  const activeAlert = hasActiveAlert(terminalId, alerts);
  const status = normalizeStatus(record, activeAlert);
  const name = readString(record, ["name", "assetName", "deviceName", "label"])
    ?? readString(lock, ["name", "assetName", "deviceName", "label"])
    ?? `Cadenas-${terminalId}`;

  const deviceDetails = buildDeviceDetails(record, lock);
  const batteryFromDevice = deviceDetails.find((detail) => detail.label === "Battery")?.value;

  return {
    id: terminalId,
    terminalId,
    name,
    code: terminalId,
    status,
    color: LIVE_MAP_COLORS[status],
    battery: batteryFromDevice ?? normalizeBattery(record, lock),
    signal: normalizeSignal(record, lock),
    lock: normalizeLockState(record, lock),
    position: extractPosition(record) ?? (lock ? extractPosition(lock) : undefined),
    updatedAt: readString(record, ["updatedAt", "lastSeenAt", "timestamp", "createdAt"]),
    deviceDetails,
  };
}

async function loadLiveAssets(force = false) {
  const [devicesPayload, locksPayload, alertsPayload] = await Promise.all([
    cachedApiJson("/devices", force),
    cachedApiJson("/locks", force).catch(() => []),
    cachedApiJson("/alerts", force).catch(() => []),
  ]);

  const devices = rowsFromPayload(devicesPayload);
  const locks = rowsFromPayload(locksPayload);
  const alerts = rowsFromPayload(alertsPayload);
  const locksByTerminal = keyByTerminal(locks);
  const sourceRows = devices.length ? devices : locks;

  const assets = sourceRows.map((row) => normalizeAsset(row, locksByTerminal, alerts));

  return assets;
}

function defaultPlaybackFromDate() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);

  return date.toISOString().slice(0, 10);
}

function defaultPlaybackToDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildHistoryPath(terminalId: string, fromDate: string, toDate: string) {
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
    maxPoints: "500",
  });

  return `/history/${encodeURIComponent(terminalId)}?${params.toString()}`;
}

function collectPositionRows(value: unknown, rows: ApiRecord[] = [], seen = new WeakSet<object>()) {
  if (!value || typeof value !== "object") {
    return rows;
  }

  if (seen.has(value)) {
    return rows;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectPositionRows(item, rows, seen));
    return rows;
  }

  const record = value as ApiRecord;

  if (extractPosition(record)) {
    rows.push(record);
  }

  Object.values(record).forEach((child) => collectPositionRows(child, rows, seen));

  return rows;
}

function uniquePositionRows(rows: ApiRecord[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const position = extractPosition(row);
    const timestamp = readString(row, ["timestamp", "createdAt", "updatedAt", "recordedAt", "time", "date"]);
    const key = `${position?.join(",") ?? "missing"}:${timestamp ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function playbackFallbackPlace(position: [number, number]) {
  return position[0].toFixed(4) + ", " + position[1].toFixed(4);
}

function positionPairsFromPayload(payload: unknown): [number, number][] {
  if (Array.isArray(payload)) {
    const directPairs = payload
      .map(positionFromPair)
      .filter((position): position is [number, number] => Boolean(position));

    if (directPairs.length) {
      return directPairs;
    }
  }

  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as ApiRecord : null;

  if (!record) {
    return [];
  }

  for (const key of ["data", "rows", "items", "results", "coordinates", "points", "history"]) {
    const value = record[key];

    if (!Array.isArray(value)) {
      continue;
    }

    const pairs = value
      .map(positionFromPair)
      .filter((position): position is [number, number] => Boolean(position));

    if (pairs.length) {
      return pairs;
    }
  }

  return [];
}

async function fetchPlaybackHistory(path: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await apiFetch(path, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as ApiRecord).message : undefined;
      throw new Error(userFriendlyError(message, "Impossible de charger l'historique du trajet."));
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Le chargement de l'historique a pris trop de temps.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function playbackPointsFromHistory(payload: unknown) {
  const positions = positionPairsFromPayload(payload);

  if (positions.length) {
    return positions.map((position): LiveMapPlaybackPoint => ({
      position,
      timestamp: undefined,
      placeName: playbackFallbackPlace(position),
    }));
  }

  const directRows = rowsFromPayload(payload);
  const rows = uniquePositionRows(directRows.length ? directRows : collectPositionRows(payload));
  const maxPlaybackPoints = 500;
  const step = rows.length > maxPlaybackPoints ? Math.ceil(rows.length / maxPlaybackPoints) : 1;

  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1)
    .map((row): LiveMapPlaybackPoint | null => {
      const position = extractPosition(row);
      if (!position) return null;

      return {
        position,
        timestamp: readString(row, ["timestamp", "createdAt", "updatedAt", "recordedAt", "time", "date"]),
        placeName: extractPlaceName(row) ?? playbackFallbackPlace(position),
      };
    })
    .filter((point): point is LiveMapPlaybackPoint => Boolean(point))
    .sort((left, right) => {
      const leftTime = left.timestamp ? Date.parse(left.timestamp) : 0;
      const rightTime = right.timestamp ? Date.parse(right.timestamp) : 0;

      return leftTime - rightTime;
    });
}

function formatPlaybackTime(timestamp?: string) {
  if (!timestamp) {
    return "Aucun horodatage";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesFilter(asset: LiveMapAsset, filter: AssetFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "locked") {
    return asset.lock === "Locked";
  }

  if (filter === "unlocked") {
    return asset.lock === "Unlocked";
  }

  return asset.status.toLowerCase() === filter;
}

export function LiveMapPanel() {
  const [assets, setAssets] = useState<LiveMapAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [playbackAsset, setPlaybackAsset] = useState<LiveMapAsset | null>(null);
  const [playbackPoints, setPlaybackPoints] = useState<LiveMapPlaybackPoint[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaybackOpen, setIsPlaybackOpen] = useState(false);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackFrom, setPlaybackFrom] = useState(defaultPlaybackFromDate);
  const [playbackTo, setPlaybackTo] = useState(defaultPlaybackToDate);

  useEffect(() => {
    if (isPlaybackOpen) return;

    let isMounted = true;

    async function refresh(force = false) {
      try {
        const nextAssets = await loadLiveAssets(force);

        if (!isMounted) {
          return;
        }

        setAssets(nextAssets);
        setError(null);
      } catch (refreshError) {
        if (!isMounted) {
          return;
        }

        setError(userFriendlyError(refreshError, "Impossible de charger les cadenas en direct."));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    refresh(false);
    const interval = window.setInterval(() => refresh(true), 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [isPlaybackOpen]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesQuery = !normalizedQuery
        || asset.name.toLowerCase().includes(normalizedQuery)
        || asset.code.toLowerCase().includes(normalizedQuery)
        || asset.terminalId.toLowerCase().includes(normalizedQuery);

      return matchesQuery && matchesFilter(asset, filter);
    });
  }, [assets, filter, query]);


  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? null,
    [assets, filteredAssets, selectedAssetId],
  );


  useEffect(() => {
    if (!isPlaybackPlaying || playbackPoints.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaybackIndex((current) => {
        if (current >= playbackPoints.length - 1) {
          setIsPlaybackPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, Math.max(160, 900 / playbackSpeed));

    return () => window.clearInterval(interval);
  }, [isPlaybackPlaying, playbackPoints.length, playbackSpeed]);

  async function loadPlayback(asset = selectedAsset) {
    if (!asset) {
      setPlaybackError("Selectionnez un cadenas avant le playback.");
      setIsPlaybackOpen(true);
      return;
    }

    setSelectedAssetId(asset.id);
    setPlaybackAsset(asset);
    setIsPlaybackOpen(true);
    setIsPlaybackLoading(true);
    setPlaybackError(null);
    setIsPlaybackPlaying(false);
    setPlaybackIndex(0);

    try {
      const payload = await fetchPlaybackHistory(buildHistoryPath(asset.terminalId, playbackFrom, playbackTo));
      const points = playbackPointsFromHistory(payload);

      setPlaybackPoints(points);
      setPlaybackError(points.length ? null : "Aucune position de playback pour ce cadenas.");
    } catch (playbackLoadError) {
      setPlaybackPoints([]);
      setPlaybackError(userFriendlyError(playbackLoadError, "Impossible de charger l'historique du playback."));
    } finally {
      setIsPlaybackLoading(false);
    }
  }

  function resetPlayback() {
    setIsPlaybackPlaying(false);
    setPlaybackIndex(0);
  }

  function exitPlayback() {
    setIsPlaybackOpen(false);
    setIsPlaybackPlaying(false);
    setIsPlaybackLoading(false);
    setPlaybackPoints([]);
    setPlaybackIndex(0);
    setPlaybackAsset(null);
    setPlaybackError(null);
  }
  const displayIsLoading = isPlaybackOpen ? false : isLoading;

  const stats = useMemo(() => ({
    all: assets.length,
    moving: assets.filter((asset) => asset.status === "Moving").length,
    idle: assets.filter((asset) => asset.status === "Idle").length,
    offline: assets.filter((asset) => asset.status === "Offline").length,
    alarm: assets.filter((asset) => asset.status === "Alarm").length,
    locked: assets.filter((asset) => asset.lock === "Locked").length,
    unlocked: assets.filter((asset) => asset.lock === "Unlocked").length,
  }), [assets]);

  return (
    <div className="grid h-[calc(100vh-56px)] min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative h-full min-h-0 overflow-hidden border-r border-[#dfe6ee] bg-[#d8eadf]">
        <LiveMapShell
          assets={filteredAssets}
          playbackPoints={isPlaybackOpen ? playbackPoints : []}
          playbackIndex={playbackIndex}
          playbackAsset={playbackAsset}
          isPlaybackOpen={isPlaybackOpen && playbackPoints.length > 0}
        />

        {displayIsLoading ? (
          <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full border border-[#dfe6ee] bg-white/95 px-4 py-2 text-[12px] font-semibold text-[#475569] shadow-sm">
            Chargement des cadenas en direct...
          </div>
        ) : null}

        {error ? (
          <div className="absolute left-1/2 top-5 z-10 max-w-[360px] -translate-x-1/2 rounded-[8px] border border-[#fecaca] bg-white px-4 py-3 text-[12px] font-semibold text-[#dc2626] shadow-sm">
            {error}
          </div>
        ) : null}

        {isPlaybackOpen && (isPlaybackLoading || playbackPoints.length) ? (
          <>
            <div className="pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-full border border-[#bfdbfe] bg-white/95 px-5 py-2 text-[12px] font-bold text-[#1d4ed8] shadow-[0_10px_24px_rgba(37,99,235,0.18)] backdrop-blur">
              <span className="mr-2 inline-flex size-2 animate-pulse rounded-full bg-[#2563eb]" />
              {isPlaybackLoading ? "Chargement du playback" : "Mode playback actif"} - {playbackAsset?.name ?? selectedAsset?.name ?? "cadenas selectionne"} - {playbackSpeed}x
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 animate-pulse bg-[linear-gradient(90deg,rgba(37,99,235,0.28),rgba(37,99,235,0.08),transparent)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 animate-pulse bg-[linear-gradient(270deg,rgba(37,99,235,0.22),rgba(37,99,235,0.06),transparent)]" />
          </>
        ) : null}

        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap justify-between gap-3 border-t border-[#dfe6ee] bg-white/95 px-4 py-3 text-[11px] text-[#64748b] backdrop-blur">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              ["Tous", stats.all, "bg-[#34C759]"],
              ["Mouvement", stats.moving, "bg-[#3b82f6]"],
              ["Arret", stats.idle, "bg-[#f97316]"],
              ["Hors ligne", stats.offline, "bg-[#94a3b8]"],
              ["Alarme", stats.alarm, "bg-[#ef4444]"],
            ].map(([label, value, color]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${color}`} />
                {label} ({value})
              </span>
            ))}
          </div>
          <div className="flex gap-x-6">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#a16207]" />
              Verrouilles : ({stats.locked})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#a7f3d0]" />
              Deverrouilles : ({stats.unlocked})
            </span>
          </div>
        </div>
      </section>

      <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <div className="border-b border-[#dfe6ee] p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" size={17} />
            <input
              className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-10 pr-4 text-[13px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
              placeholder="Rechercher un cadenas ou un ID..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <h1 className="text-[14px] font-bold">Tous les cadenas ({filteredAssets.length})</h1>
          <select
            aria-label="Filtrer les cadenas"
            className="h-8 rounded-[7px] border border-[#dfe6ee] bg-white px-2.5 text-[12px] font-medium text-[#475569] outline-none transition focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
            value={filter}
            onChange={(event) => setFilter(event.target.value as AssetFilter)}
          >
            <option value="all">Tous</option>
            <option value="moving">En mouvement</option>
            <option value="idle">A l&apos;arret</option>
            <option value="alarm">Alarme</option>
            <option value="offline">Hors ligne</option>
            <option value="locked">Verrouille</option>
            <option value="unlocked">Deverrouille</option>
          </select>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {filteredAssets.length ? (
            filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isSelected={selectedAsset?.id === asset.id}
                onSelect={(nextAsset) => {
                  setSelectedAssetId(nextAsset.id);
                  if (isPlaybackOpen) {
                    loadPlayback(nextAsset);
                  }
                }}
              />
            ))
          ) : (
            <div className="mx-2 rounded-[8px] border border-dashed border-[#d5e0ea] p-4 text-[13px] text-[#64748b]">
              {displayIsLoading ? "Chargement des cadenas..." : "Aucun cadenas ne correspond a cette vue."}
            </div>
          )}
        </div>

        <div className="border-t border-[#dfe6ee] bg-white px-5 py-4">
          <div className="rounded-[10px] border border-[#dfe6ee] bg-[#f8fafc] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#111827]">Lecture du trajet</p>
                <p className="mt-0.5 truncate text-[11px] text-[#64748b]">
                  {selectedAsset ? selectedAsset.name : "Selectionnez un cadenas"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadPlayback()}
                className="grid size-9 place-items-center rounded-[8px] bg-[#111827] text-white transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                disabled={isPlaybackLoading || !selectedAsset}
                aria-label="Charger le playback"
                title="Charger le playback"
              >
                {isPlaybackLoading ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
              </button>
            </div>

            {isPlaybackOpen ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-semibold uppercase text-[#64748b]">
                    Debut
                    <input
                      type="date"
                      value={playbackFrom}
                      onChange={(event) => setPlaybackFrom(event.target.value)}
                      className="mt-1 h-8 w-full rounded-[7px] border border-[#dfe6ee] bg-white px-2 text-[11px] normal-case text-[#111827] outline-none focus:border-[#2A9D90]"
                    />
                  </label>
                  <label className="text-[10px] font-semibold uppercase text-[#64748b]">
                    Fin
                    <input
                      type="date"
                      value={playbackTo}
                      onChange={(event) => setPlaybackTo(event.target.value)}
                      className="mt-1 h-8 w-full rounded-[7px] border border-[#dfe6ee] bg-white px-2 text-[11px] normal-case text-[#111827] outline-none focus:border-[#2A9D90]"
                    />
                  </label>
                </div>

                <div className="space-y-2 rounded-[8px] bg-white px-3 py-2 text-[11px] text-[#64748b]">
                  <div className="flex items-center justify-between gap-3">
                    <span>{playbackPoints.length} positions</span>
                    <span>{formatPlaybackTime(playbackPoints[playbackIndex]?.timestamp)}</span>
                  </div>
                  <div className="truncate font-semibold text-[#111827]">
                    {playbackPoints[playbackIndex]?.placeName ?? "Lieu indisponible"}
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max={Math.max(0, playbackPoints.length - 1)}
                  value={playbackIndex}
                  onChange={(event) => {
                    setPlaybackIndex(Number(event.target.value));
                    setIsPlaybackPlaying(false);
                  }}
                  disabled={!playbackPoints.length}
                  className="w-full accent-[#2563eb]"
                  aria-label="Chronologie du playback"
                />

                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaybackPlaying((current) => !current)}
                    disabled={playbackPoints.length <= 1}
                    className="flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] text-[12px] font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
                  >
                    {isPlaybackPlaying ? <Pause size={15} /> : <Play size={15} />}
                    {isPlaybackPlaying ? "Pause" : "Lire le trajet"}
                  </button>
                  <button
                    type="button"
                    onClick={resetPlayback}
                    disabled={!playbackPoints.length}
                    className="grid size-9 place-items-center rounded-[8px] border border-[#dfe6ee] bg-white text-[#475569] transition hover:border-[#2563eb] hover:text-[#2563eb] disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
                    aria-label="Reinitialiser le playback"
                    title="Reinitialiser le playback"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={exitPlayback}
                    className="grid size-9 place-items-center rounded-[8px] border border-[#fee2e2] bg-white text-[#dc2626] transition hover:bg-[#fef2f2]"
                    aria-label="Quitter le mode playback"
                    title="Quitter le mode playback"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1 rounded-[8px] bg-white p-1">
                  {[0.5, 1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackSpeed(speed)}
                      className={"h-7 rounded-[6px] text-[11px] font-bold transition " + (playbackSpeed === speed ? "bg-[#111827] text-white" : "text-[#64748b] hover:bg-[#f1f5f9]")}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                {playbackError ? (
                  <p className="rounded-[8px] border border-[#fee2e2] bg-white px-3 py-2 text-[11px] font-medium text-[#dc2626]">
                    {playbackError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#dfe6ee] bg-[#f8fafc] px-5 py-4 text-[12px] text-[#64748b]">
          <span>Vue groupee</span>
          <div className="flex items-center gap-4">
            <button className="grid size-7 place-items-center rounded-full bg-white" type="button" aria-label="Page precedente">
              &lsaquo;
            </button>
            <span className="font-semibold text-[#475569]">1 / 1</span>
            <button className="grid size-7 place-items-center rounded-full bg-white" type="button" aria-label="Page suivante">
              &rsaquo;
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}