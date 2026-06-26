"use client";

import Link from "next/link";
import {
  Circle,
  Edit3,
  Globe2,
  MapPin,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  cachedApiJson,
  clearAppCache,
  getGeoBoundaries,
  getGeoBoundaryById,
} from "../../lib/api";
import { userFriendlyError } from "../../lib/error-messages";
import { GeofenceMapShell } from "./geofence-map-shell";
import type { BoundarySummary, GeofenceAccessMode, LatLngTuple, LockMapAsset, SavedGeofence } from "./geofence-types";

type LoadState = "idle" | "loading" | "ready" | "error";
type ApiRecord = Record<string, unknown>;

const continentOptions = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

function rowsFromPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.data)) {
      return record.data;
    }

    if (Array.isArray(record.items)) {
      return record.items;
    }

    if (Array.isArray(record.results)) {
      return record.results;
    }
  }

  return [];
}


function apiRowsFromPayload(payload: unknown): ApiRecord[] {
  return rowsFromPayload(payload).filter(
    (row): row is ApiRecord => Boolean(row) && typeof row === "object",
  );
}

function firstNumberValue(record: ApiRecord | null | undefined, keys: string[]) {
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

function firstBooleanValue(record: ApiRecord | null | undefined, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

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

function lockContainers(record: ApiRecord | null | undefined) {
  if (!record) {
    return [];
  }

  const containers = [record];

  for (const key of ["position", "lastPosition", "latestPosition", "location", "gps", "telemetry", "status", "device", "lock", "data"]) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      containers.push(value as ApiRecord);
    }
  }

  return containers;
}

function firstNestedString(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of lockContainers(record)) {
    const value = firstStringValue(...keys.map((key) => source[key]));

    if (value) {
      return value;
    }
  }

  return undefined;
}

function firstNestedNumber(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of lockContainers(record)) {
    const value = firstNumberValue(source, keys);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function firstNestedBoolean(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of lockContainers(record)) {
    const value = firstBooleanValue(source, keys);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function positionFromPair(value: unknown): LatLngTuple | null {
  if (!Array.isArray(value) || value.length < 2 || Array.isArray(value[0]) || Array.isArray(value[1])) {
    return null;
  }

  const first = Number(value[0]);
  const second = Number(value[1]);

  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return [first, second];
  }

  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) {
    return [second, first];
  }

  return null;
}

function extractLockPosition(record: ApiRecord | null | undefined): LatLngTuple | null {
  if (!record) {
    return null;
  }

  const directPair = positionFromPair(record);

  if (directPair) {
    return directPair;
  }

  for (const source of lockContainers(record)) {
    const latitude = firstNumberValue(source, ["lat", "latitude", "gpsLat", "gpsLatitude", "y"]);
    const longitude = firstNumberValue(source, ["lng", "lon", "long", "longitude", "gpsLng", "gpsLon", "gpsLongitude", "x"]);

    if (latitude !== undefined && longitude !== undefined && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return [latitude, longitude];
    }

    for (const key of ["coordinates", "coords", "position", "location", "gps"]) {
      const position = positionFromPair(source[key]);

      if (position) {
        return position;
      }
    }
  }

  return null;
}

function terminalIdFromRecord(record: ApiRecord) {
  return firstStringValue(record.terminalId, record.terminalID, record.deviceId, record.lockId, record.id, record.serial, record.imei) ?? "unknown";
}

function normalizeBattery(record: ApiRecord, lock?: ApiRecord) {
  const raw = firstNestedString(record, ["battery", "batteryLevel", "power", "batteryPercent"]) ?? firstNestedString(lock, ["battery", "batteryLevel", "power", "batteryPercent"]);

  if (raw) {
    const match = raw.match(/\d+(?:\.\d+)?/);

    if (match) {
      return Math.max(0, Math.min(100, Math.round(Number(match[0])))) + "%";
    }
  }

  const value = firstNestedNumber(record, ["battery", "batteryLevel", "power", "batteryPercent"]) ?? firstNestedNumber(lock, ["battery", "batteryLevel", "power", "batteryPercent"]);

  return value === undefined ? undefined : Math.max(0, Math.min(100, Math.round(value))) + "%";
}

function normalizeLockState(record: ApiRecord, lock?: ApiRecord): LockMapAsset["lock"] {
  const raw = firstNestedString(record, ["lock", "lockState", "locked", "statusLock"]) ?? firstNestedString(lock, ["lock", "lockState", "locked", "statusLock"]);
  const locked = firstNestedBoolean(record, ["locked", "isLocked"]) ?? firstNestedBoolean(lock, ["locked", "isLocked"]);

  if (locked === true || raw?.toLowerCase() === "locked") {
    return "Locked";
  }

  if (locked === false || raw?.toLowerCase() === "unlocked") {
    return "Unlocked";
  }

  return "Unknown";
}

function normalizeLockStatus(record: ApiRecord): LockMapAsset["status"] {
  const raw = firstNestedString(record, ["status", "state", "movementStatus", "motion", "online"]);
  const online = firstNestedBoolean(record, ["online", "isOnline", "connected"]);

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

  return online === false ? "Offline" : "Moving";
}

function normalizeLockAsset(record: ApiRecord, lock?: ApiRecord): LockMapAsset | null {
  const position = extractLockPosition(record) ?? extractLockPosition(lock);

  if (!position) {
    return null;
  }

  const id = terminalIdFromRecord(record);

  return {
    id,
    name: firstNestedString(record, ["name", "assetName", "deviceName", "label"]) ?? firstNestedString(lock, ["name", "assetName", "deviceName", "label"]) ?? "Device-" + id,
    status: normalizeLockStatus(record),
    lock: normalizeLockState(record, lock),
    battery: normalizeBattery(record, lock),
    updatedAt: firstNestedString(record, ["updatedAt", "lastSeenAt", "timestamp", "createdAt"]),
    position,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function firstStringValue(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);

    if (text) {
      return text;
    }
  }

  return undefined;
}

function relationId(value: unknown) {
  const direct = stringValue(value);

  if (direct) {
    return direct;
  }

  const record = asRecord(value);

  if (!record) {
    return undefined;
  }

  return firstStringValue(
    record.id,
    record.uuid,
    record._id,
    record.geoBoundaryId,
    record.boundaryId,
  );
}

function sameText(left: string | undefined, right: string | undefined) {
  return Boolean(
    left &&
      right &&
      left.trim().toLowerCase() === right.trim().toLowerCase(),
  );
}

function normalizeBoundaries(payload: unknown): BoundarySummary[] {
  return rowsFromPayload(payload).reduce<BoundarySummary[]>((items, row, index) => {
    if (!row || typeof row !== "object") {
      return items;
    }

    const record = row as Record<string, unknown>;
    const country = asRecord(record.country);
    const id =
      relationId(record) ??
      `${record.name ?? record.label ?? "boundary"}-${index}`;
    const name =
      firstStringValue(record.name, record.label, country?.name) ??
      "Unnamed country";
    const continent = firstStringValue(record.continent, country?.continent);

    items.push({
      id,
      name,
      type: String(record.type ?? "country"),
      countryCode: firstStringValue(
        record.countryCode,
        record.code,
        record.iso2,
        record.iso3,
        country?.countryCode,
        country?.code,
        country?.iso2,
        country?.iso3,
      ),
      continent,
    });

    return items;
  }, []);
}

function toLatLngTuple(value: unknown): LatLngTuple | null {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);

    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude, longitude]
      : null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const latitude = Number(record.latitude ?? record.lat);
    const longitude = Number(record.longitude ?? record.lng ?? record.lon);

    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude, longitude]
      : null;
  }

  return null;
}

function bboxToRing(value: unknown): LatLngTuple[] {
  if (typeof value === "string") {
    try {
      return bboxToRing(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (Array.isArray(value) && value.length >= 4) {
    const west = Number(value[0]);
    const south = Number(value[1]);
    const east = Number(value[2]);
    const north = Number(value[3]);

    if ([west, south, east, north].every(Number.isFinite)) {
      return [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
        [south, west],
      ];
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    const first = toLatLngTuple(value[0]);
    const second = toLatLngTuple(value[1]);

    if (first && second) {
      const south = Math.min(first[0], second[0]);
      const north = Math.max(first[0], second[0]);
      const west = Math.min(first[1], second[1]);
      const east = Math.max(first[1], second[1]);

      return [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
        [south, west],
      ];
    }
  }

  const record = asRecord(value);

  if (!record) {
    return [];
  }

  const west = Number(record.west ?? record.minLng ?? record.minLon ?? record.left);
  const south = Number(record.south ?? record.minLat ?? record.bottom);
  const east = Number(record.east ?? record.maxLng ?? record.maxLon ?? record.right);
  const north = Number(record.north ?? record.maxLat ?? record.top);

  if (![west, south, east, north].every(Number.isFinite)) {
    return [];
  }

  return [
    [south, west],
    [south, east],
    [north, east],
    [north, west],
    [south, west],
  ];
}

function ringsFromGeometry(geometry: unknown): LatLngTuple[][] {
  if (typeof geometry === "string") {
    try {
      return ringsFromGeometry(JSON.parse(geometry));
    } catch {
      return [];
    }
  }

  const directBboxRing = bboxToRing(geometry);

  if (directBboxRing.length >= 4) {
    return [directBboxRing];
  }

  if (!geometry || typeof geometry !== "object") {
    return [];
  }

  const record = geometry as Record<string, unknown>;
  const type = String(record.type ?? "");

  if (type === "Feature") {
    const featureRings = ringsFromGeometry(record.geometry);
    const bboxRing = bboxToRing(record.bbox);

    return featureRings.length > 0
      ? featureRings
      : bboxRing.length >= 4
        ? [bboxRing]
        : [];
  }

  if (type === "FeatureCollection" && Array.isArray(record.features)) {
    const featureRings = record.features.flatMap((feature) =>
      ringsFromGeometry(feature),
    );
    const bboxRing = bboxToRing(record.bbox);

    return featureRings.length > 0
      ? featureRings
      : bboxRing.length >= 4
        ? [bboxRing]
        : [];
  }

  const coordinates = record.coordinates;

  if (!Array.isArray(coordinates)) {
    const bboxRing = bboxToRing(record.bbox);

    return bboxRing.length >= 4 ? [bboxRing] : [];
  }

  if (!type) {
    const directRing = coordinates
      .map(toLatLngTuple)
      .filter((point): point is LatLngTuple => Boolean(point));

    if (directRing.length >= 3) {
      return [directRing];
    }

    const polygonRings = coordinates
      .map((ring) =>
        Array.isArray(ring)
          ? ring.map(toLatLngTuple).filter((point): point is LatLngTuple => Boolean(point))
          : [],
      )
      .filter((ring) => ring.length >= 3);

    if (polygonRings.length > 0) {
      return polygonRings;
    }

    return coordinates.flatMap((polygon) =>
      Array.isArray(polygon)
        ? polygon
            .map((ring) =>
              Array.isArray(ring)
                ? ring
                    .map(toLatLngTuple)
                    .filter((point): point is LatLngTuple => Boolean(point))
                : [],
            )
            .filter((ring) => ring.length >= 3)
        : [],
    );
  }

  if (type === "Polygon") {
    return coordinates
      .map((ring) =>
        Array.isArray(ring)
          ? ring.map(toLatLngTuple).filter((point): point is LatLngTuple => Boolean(point))
          : [],
      )
      .filter((ring) => ring.length >= 3);
  }

  if (type === "MultiPolygon") {
    return coordinates.flatMap((polygon) =>
      Array.isArray(polygon)
        ? polygon
            .map((ring) =>
              Array.isArray(ring)
                ? ring
                    .map(toLatLngTuple)
                    .filter((point): point is LatLngTuple => Boolean(point))
                : [],
            )
            .filter((ring) => ring.length >= 3)
        : [],
    );
  }

  return [];
}

function pointsFromCoordinates(value: unknown): LatLngTuple[] {
  if (typeof value === "string") {
    try {
      return pointsFromCoordinates(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const directPoints = value
    .map(toLatLngTuple)
    .filter((point): point is LatLngTuple => Boolean(point));

  if (directPoints.length > 0) {
    return directPoints;
  }

  return value.flatMap(pointsFromCoordinates);
}

function pointIsInsideRing(point: LatLngTuple, ring: LatLngTuple[]) {
  const [latitude, longitude] = point;
  let isInside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLatitude, currentLongitude] = ring[current];
    const [previousLatitude, previousLongitude] = ring[previous];
    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude;
    const crossingLongitude =
      ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude || Number.EPSILON) +
      currentLongitude;

    if (crossesLatitude && longitude < crossingLongitude) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function geofencePoints(geofence: SavedGeofence) {
  const ringPoints = geofence.rings?.flatMap((ring) => ring.slice(0, 3)) ?? [];

  return [...geofence.points, ...ringPoints];
}

function geometryFromRecord(record: Record<string, unknown>) {
  const boundary = asRecord(record.boundary) ?? asRecord(record.geoBoundary);

  return (
    record.geometry ??
    record.geojson ??
    record.geoJson ??
    record.geoJSON ??
    record.shape ??
    record.boundaryGeometry ??
    record.geoBoundaryGeometry ??
    boundary?.geometry ??
    boundary?.geojson ??
    boundary?.geoJson ??
    boundary?.geoJSON ??
    record.bbox ??
    record.boundingBox ??
    boundary?.bbox ??
    boundary?.boundingBox
  );
}

function booleanFromRecord(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "yes", "allowed", "allow"].includes(normalized)) {
        return true;
      }

      if (["false", "no", "blocked", "block", "denied"].includes(normalized)) {
        return false;
      }
    }
  }

  return undefined;
}

function geofenceAccessMode(record: Record<string, unknown>): GeofenceAccessMode {
  return record.accessMode === "allow_outside" ? "allow_outside" : "allow_inside";
}

function lockAccessAllowedFromRecord(record: Record<string, unknown>) {
  const rules = asRecord(record.rules);

  return booleanFromRecord(rules, ["lockAccessAllowed"])
    ?? booleanFromRecord(record, ["lockAccessAllowed", "unlockAllowed", "canUnlock", "allowUnlock"])
    ?? true;
}

function UnlockPermissionStatus({
  geofence,
  editable = false,
  isEditing = false,
  isSaving = false,
  draftAllowed,
  onEdit,
  onCancel,
  onDraftChange,
  onSave,
}: {
  geofence: SavedGeofence;
  editable?: boolean;
  isEditing?: boolean;
  isSaving?: boolean;
  draftAllowed?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onDraftChange?: (allowed: boolean) => void;
  onSave?: () => void;
}) {
  const value = isEditing ? Boolean(draftAllowed) : geofence.lockAccessAllowed;

  return (
    <div className="mt-3 rounded-[8px] border border-[#dfe6ee] bg-[#fbfdff] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-[#0f172a]">Autorisation dans cette zone</p>
        {editable && !isEditing ? (
          <button type="button" onClick={onEdit} className="rounded-[6px] border border-[#dfe6ee] bg-white px-2 py-1 text-[11px] font-semibold text-[#334155]">
            Modifier
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[#63758d]">
        Choisissez si le cadenas peut etre deverrouille lorsqu&apos;il se trouve dans cette geofence.
      </p>
      <div className="mt-2 space-y-2 text-[12px] text-[#0f172a]">
        <label className="flex items-start gap-2 rounded-[7px] bg-white px-3 py-2 ring-1 ring-[#e3e9f0]">
          <input
            checked={value}
            readOnly={!isEditing}
            onChange={() => onDraftChange?.(true)}
            type="checkbox"
            className="mt-0.5 size-4 accent-[#111827]"
          />
          <span>
            <span className="block font-semibold">Deverrouillage autorise</span>
            <span className="block text-[11px] text-[#63758d]">Le cadenas peut etre ouvert dans cette zone.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-[7px] bg-white px-3 py-2 ring-1 ring-[#e3e9f0]">
          <input
            checked={!value}
            readOnly={!isEditing}
            onChange={() => onDraftChange?.(false)}
            type="checkbox"
            className="mt-0.5 size-4 accent-[#111827]"
          />
          <span>
            <span className="block font-semibold">Deverrouillage bloque</span>
            <span className="block text-[11px] text-[#63758d]">Le cadenas ne doit pas etre ouvert dans cette zone.</span>
          </span>
        </label>
      </div>
      {isEditing ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onSave} disabled={isSaving} className="h-8 rounded-[6px] bg-[#111827] px-3 text-[12px] font-semibold text-white disabled:opacity-60">
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button type="button" onClick={onCancel} disabled={isSaving} className="h-8 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold text-[#334155] disabled:opacity-60">
            Annuler
          </button>
        </div>
      ) : null}
    </div>
  );
}

function boundaryToGeofence(boundary: BoundarySummary): SavedGeofence {
  return {
    id: `boundary-geofence-${boundary.id}`,
    name: boundary.name,
    number: boundary.countryCode ?? boundary.type,
    description: "Zone issue des limites importees.",
    area: boundary.type,
    shapeType: "polygon",
    points: [],
    rings: [],
    radiusMeters: 0,
    accessMode: "allow_inside",
    lockAccessAllowed: true,
    source: "boundary",
    syncStatus: "synced",
    geoBoundaryId: boundary.id,
    countryCode: boundary.countryCode,
    countryName: boundary.name,
  };
}

function normalizeGeofences(payload: unknown): SavedGeofence[] {
  return rowsFromPayload(payload).reduce<SavedGeofence[]>((items, row, index) => {
    if (!row || typeof row !== "object") {
      return items;
    }

    const record = row as Record<string, unknown>;
    const boundary = asRecord(record.boundary) ?? asRecord(record.geoBoundary);
    const country = asRecord(record.country);
    const shapeType =
      record.shapeType === "circle"
        ? "circle"
        : (record.shapeType === "route" || record.shapeType === "line")
          ? "route"
          : "polygon";
    const geometry = geometryFromRecord(record);
    const bboxRings = [bboxToRing(record.bbox), bboxToRing(record.boundingBox)].filter(
      (ring) => ring.length >= 4,
    );
    const rings = bboxRings.length > 0 ? bboxRings : ringsFromGeometry(geometry);
    const points = pointsFromCoordinates(
      record.coordinates ??
        record.points ??
        record.path ??
        record.center ??
        record.location ??
        record.position,
    );
    const geoBoundaryId =
      relationId(record.geoBoundaryId) ??
      relationId(record.boundaryId) ??
      relationId(record.boundary) ??
      relationId(record.geoBoundary);
    const accessMode = geofenceAccessMode(record);
    const lockAccessAllowed = lockAccessAllowedFromRecord(record);

    items.push({
      id: String(record.id ?? record.uuid ?? record._id ?? `api-geofence-${index}`),
      name: String(record.name ?? "Geofence enregistree"),
      number: String(record.number ?? record.code ?? `GF-${String(index + 1).padStart(3, "0")}`),
      description: String(record.description ?? "Regle de geofence"),
      area: String(record.area ?? record.type ?? "Live"),
      shapeType: bboxRings.length > 0 ? "polygon" : shapeType,
      points,
      rings,
      radiusMeters: Number(record.radiusMeters ?? 25000),
      accessMode,
      lockAccessAllowed,
      source: geoBoundaryId ? "boundary" : "custom",
      syncStatus: "synced",
      geoBoundaryId,
      countryCode: firstStringValue(
        record.countryCode,
        record.code,
        record.iso2,
        record.iso3,
        country?.countryCode,
        country?.code,
        country?.iso2,
        country?.iso3,
        boundary?.countryCode,
        boundary?.code,
        boundary?.iso2,
        boundary?.iso3,
      ),
      countryName: firstStringValue(
        record.countryName,
        record.boundaryName,
        record.geoBoundaryName,
        country?.name,
        boundary?.name,
        boundary?.label,
      ),
    });

    return items;
  }, []);
}

function geofenceMatchesCountry(
  geofence: SavedGeofence,
  country: BoundarySummary | undefined,
  countryRings: LatLngTuple[][],
) {
  if (!country) {
    return false;
  }

  return (
    sameText(geofence.geoBoundaryId, country.id) ||
    sameText(geofence.countryCode, country.countryCode) ||
    sameText(geofence.countryName, country.name) ||
    geofence.name.toLowerCase().includes(country.name.toLowerCase()) ||
    geofencePoints(geofence).some((point) =>
      countryRings.some((ring) => pointIsInsideRing(point, ring)),
    )
  );
}

export function GeofenceWorkspace() {
  const [countries, setPays] = useState<BoundarySummary[]>([]);
  const [geofences, setGeofences] = useState<SavedGeofence[]>([]);
  const [lockAssets, setLockAssets] = useState<LockMapAsset[]>([]);
  const [selectedContinent, setSelectedContinent] = useState(continentOptions[0]);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryCenter, setCountryCenter] = useState<LatLngTuple | null>(null);
  const [countryRings, setCountryRings] = useState<LatLngTuple[][]>([]);
  const [countryPresetGeofence, setCountryPresetGeofence] =
    useState<SavedGeofence | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("Chargement des geofences.");
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [draftLockAccessAllowed, setDraftLockAccessAllowed] = useState(true);
  const [savingGeofenceId, setSavingGeofenceId] = useState<string | null>(null);
  const [deletingGeofenceId, setDeletingGeofenceId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setLoadState("loading");

      try {
        const [geofencePayload, devicesPayload, locksPayload] = await Promise.all([
          cachedApiJson("/geofences", true),
          cachedApiJson("/devices", true).catch(() => []),
          cachedApiJson("/locks", true).catch(() => []),
        ]);
        const normalizedGeofences = normalizeGeofences(geofencePayload);
        const locks = apiRowsFromPayload(locksPayload);
        const locksByTerminal = new Map(
          locks.map((lock) => [terminalIdFromRecord(lock), lock]),
        );
        const devices = apiRowsFromPayload(devicesPayload);
        const sourceRows = devices.length > 0 ? devices : locks;
        const normalizedLockAssets = sourceRows
          .map((row) => normalizeLockAsset(row, locksByTerminal.get(terminalIdFromRecord(row))))
          .filter((asset): asset is LockMapAsset => Boolean(asset));

        if (!isMounted) {
          return;
        }

        setGeofences(normalizedGeofences);
        setLockAssets(normalizedLockAssets);
        setLoadState("ready");
        setMessage("Selectionnez un continent puis un pays pour afficher les geofences.");
      } catch {
        if (isMounted) {
          setLoadState("error");
          setMessage("Impossible de charger les geofences. Verifiez votre connexion et votre session.");
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedContinent) {
      return;
    }

    let isMounted = true;

    async function loadPaysForContinent() {
      try {
        const payload = await getGeoBoundaries(
          {
            type: "country",
            continent: selectedContinent,
            limit: 100,
          },
          true,
        );
        const normalizedPays = normalizeBoundaries(payload);

        if (isMounted) {
          setPays(normalizedPays);
          setSelectedCountryId(normalizedPays[0]?.id ?? "");
          setSelectedGeofenceId(null);
          setCountryPresetGeofence(null);
          setCountrySearch("");
          setMessage(
            normalizedPays.length > 0
              ? `Pays de ${selectedContinent} charges.`
              : `No countries returned for ${selectedContinent}.`,
          );
        }
      } catch {
        if (isMounted) {
          setPays([]);
          setSelectedCountryId("");
          setSelectedGeofenceId(null);
          setMessage(`Impossible de charger les pays de ${selectedContinent}.`);
        }
      }
    }

    loadPaysForContinent();

    return () => {
      isMounted = false;
    };
  }, [selectedContinent]);

  const selectedCountry = countries.find((country) => country.id === selectedCountryId);

  const countriesInContinent = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    return countries
      .filter((country) =>
        query
          ? [country.name, country.countryCode]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(query))
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, countrySearch]);

  const countryGeofences = useMemo(
    () => {
      const matchedGeofences = geofences.filter((geofence) =>
        geofenceMatchesCountry(geofence, selectedCountry, countryRings),
      );

      return countryPresetGeofence
        ? [countryPresetGeofence, ...matchedGeofences]
        : matchedGeofences;
    },
    [countryPresetGeofence, countryRings, geofences, selectedCountry],
  );

  const customGeofences = useMemo(
    () => geofences.filter((geofence) => geofence.source === "custom"),
    [geofences],
  );

  const selectedCustomGeofence = customGeofences.find(
    (geofence) => geofence.id === selectedGeofenceId,
  );

  const mapGeofences = useMemo(
    () =>
      selectedCustomGeofence &&
      !countryGeofences.some((geofence) => geofence.id === selectedCustomGeofence.id)
        ? [selectedCustomGeofence, ...countryGeofences]
        : countryGeofences,
    [countryGeofences, selectedCustomGeofence],
  );

  const mapCenter =
    selectedCustomGeofence?.points[0] ??
    selectedCustomGeofence?.rings?.[0]?.[0] ??
    countryCenter;

  useEffect(() => {
    if (!selectedCountryId) {
      return;
    }

    let isMounted = true;

    async function loadCountryGeometry() {
      try {
        const payload = await getGeoBoundaryById(selectedCountryId);
        const record =
          payload && typeof payload === "object" && "data" in payload
            ? (payload as Record<string, unknown>).data
            : payload;
        const geometry =
          record && typeof record === "object"
            ? geometryFromRecord(record as Record<string, unknown>)
            : undefined;
        const countryRecord =
          record && typeof record === "object"
            ? (record as Record<string, unknown>)
            : undefined;
        const geometryRings = ringsFromGeometry(geometry);
        const bboxRings =
          countryRecord && "bbox" in countryRecord
            ? [bboxToRing(countryRecord.bbox)].filter((ring) => ring.length >= 4)
            : [];
        const rings = geometryRings.length > 0 ? geometryRings : bboxRings;
        const nextCenter = rings[0]?.[0] ?? null;

        if (isMounted) {
          setCountryCenter(nextCenter);
          setCountryRings(rings);
          setCountryPresetGeofence(
            selectedCountry && rings.length > 0
              ? {
                  ...boundaryToGeofence(selectedCountry),
                  name: `${selectedCountry.name} boundary geofence`,
                  description:
                    "Zone creee a partir de la limite du pays.",
                  area: "Limite du pays",
                  rings,
                }
              : null,
          );
        }
      } catch {
        if (isMounted) {
          setCountryCenter(null);
          setCountryRings([]);
          setCountryPresetGeofence(null);
        }
      }
    }

    loadCountryGeometry();

    return () => {
      isMounted = false;
    };
  }, [selectedCountry, selectedCountryId]);

  function selectContinent(continent: string) {
    setSelectedContinent(continent);
    setSelectedCountryId("");
    setSelectedGeofenceId(null);
    setCountryPresetGeofence(null);
    setCountrySearch("");
  }

  function selectCustomGeofence(geofence: SavedGeofence) {
    setSelectedGeofenceId(geofence.id);
    setMessage(geofence.name + " selectionnee.");
  }

  function startEditGeofence(geofence: SavedGeofence) {
    setSelectedGeofenceId(geofence.id);
    setEditingGeofenceId(geofence.id);
    setDraftLockAccessAllowed(geofence.lockAccessAllowed);
  }

  function cancelEditGeofence() {
    setEditingGeofenceId(null);
  }

  async function updateGeofencePermission(geofence: SavedGeofence) {
    setSavingGeofenceId(geofence.id);
    setMessage("Mise a jour de la geofence...");

    try {
      const nextAccessMode: GeofenceAccessMode = draftLockAccessAllowed ? "allow_inside" : "allow_outside";
      const response = await apiFetch("/geofences/" + encodeURIComponent(geofence.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessMode: nextAccessMode,
          rules: { lockAccessAllowed: draftLockAccessAllowed },
        }),
      });

      if (!response.ok) throw new Error("La modification n'a pas ete acceptee.");

      setGeofences((current) => current.map((item) => item.id === geofence.id ? { ...item, accessMode: nextAccessMode, lockAccessAllowed: draftLockAccessAllowed } : item));
      clearAppCache();
      setEditingGeofenceId(null);
      setMessage("Geofence mise a jour.");
    } catch (error) {
      setMessage(userFriendlyError(error, "Impossible de modifier cette geofence."));
    } finally {
      setSavingGeofenceId(null);
    }
  }

  async function deleteGeofence(geofence: SavedGeofence) {
    if (!window.confirm("Supprimer cette geofence ?")) return;

    setDeletingGeofenceId(geofence.id);
    setMessage("Suppression de la geofence...");

    try {
      const response = await apiFetch("/geofences/" + encodeURIComponent(geofence.id), { method: "DELETE" });
      if (!response.ok) throw new Error("La suppression n'a pas ete acceptee.");

      setGeofences((current) => current.filter((item) => item.id !== geofence.id));
      if (selectedGeofenceId === geofence.id) setSelectedGeofenceId(null);
      if (editingGeofenceId === geofence.id) setEditingGeofenceId(null);
      clearAppCache();
      setMessage("Geofence supprimee.");
    } catch (error) {
      setMessage(userFriendlyError(error, "Impossible de supprimer cette geofence."));
    } finally {
      setDeletingGeofenceId(null);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 xl:grid-cols-[230px_330px_minmax(0,1fr)]">
      <aside className="border-r border-[#dfe6ee] bg-white px-4 py-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-normal text-black">
            Geofence
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-[#63758d]">
            Consultez les zones par continent et gerez vos geofences personnalisees.
          </p>
        </div>

        <div className="mt-5 space-y-2">
          {continentOptions.map((continent) => {
            return (
              <button
                key={continent}
                type="button"
                onClick={() => selectContinent(continent)}
                className={`flex w-full items-center justify-between rounded-[7px] border px-3 py-3 text-left transition ${
                  selectedContinent === continent
                    ? "border-[#2A9D90] bg-[#ecfdf5] text-[#0f172a]"
                    : "border-[#e3e9f0] bg-white text-[#52657d] hover:border-[#b7c4d1]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Globe2 size={15} />
                  <span className="truncate text-[13px] font-semibold">
                    {continent}
                  </span>
                </span>
                <span className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-[10px] font-bold text-[#52657d]">
                  {selectedContinent === continent ? countries.length : ""}
                </span>
              </button>
            );
          })}

          {loadState === "loading" ? (
            <p className="rounded-[7px] bg-[#f8fafc] px-3 py-3 text-[12px] text-[#63758d]">
              Chargement des continents...
            </p>
          ) : null}

          {loadState === "error" ? (
            <p className="rounded-[7px] border border-red-100 bg-red-50 px-3 py-3 text-[12px] leading-snug text-red-700">
              {message}
            </p>
          ) : null}
        </div>


        <div className="mt-6 border-t border-[#dfe6ee] pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-bold text-[#0f172a]">
              Geofences personnalisees
            </h2>
            <span className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-[10px] font-bold text-[#52657d]">
              {customGeofences.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {customGeofences.map((geofence) => (
              <div
                key={`custom-geofence-${geofence.id}`}
                className={`rounded-[7px] border px-3 py-3 transition ${
                  selectedGeofenceId === geofence.id
                    ? "border-[#2A9D90] bg-[#ecfdf5]"
                    : "border-[#e3e9f0] bg-white hover:border-[#b7c4d1]"
                }`}
              >
                <button type="button" onClick={() => selectCustomGeofence(geofence)} className="w-full text-left">
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-[#0f172a]">
                    {geofence.shapeType === "circle" ? <Circle size={13} /> : <MapPin size={13} />}
                    <span className="truncate">{geofence.name}</span>
                  </span>
                  <span className="mt-1 block text-[10px] text-[#718096]">
                    {geofence.shapeType} - {geofence.area}
                  </span>
                </button>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditGeofence(geofence)}
                    className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[#dfe6ee] bg-white px-2 text-[11px] font-semibold text-[#334155]"
                  >
                    <Edit3 size={12} /> Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteGeofence(geofence)}
                    disabled={deletingGeofenceId === geofence.id}
                    className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-red-100 bg-red-50 px-2 text-[11px] font-semibold text-red-700 disabled:opacity-60"
                  >
                    <Trash2 size={12} /> {deletingGeofenceId === geofence.id ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </div>
            ))}
            {selectedCustomGeofence ? (
              <UnlockPermissionStatus
                geofence={selectedCustomGeofence}
                editable
                isEditing={editingGeofenceId === selectedCustomGeofence.id}
                isSaving={savingGeofenceId === selectedCustomGeofence.id}
                draftAllowed={draftLockAccessAllowed}
                onEdit={() => startEditGeofence(selectedCustomGeofence)}
                onCancel={cancelEditGeofence}
                onDraftChange={setDraftLockAccessAllowed}
                onSave={() => updateGeofencePermission(selectedCustomGeofence)}
              />
            ) : null}
            {customGeofences.length === 0 ? (
              <p className="rounded-[7px] border border-dashed border-[#cbd5e1] bg-[#fbfdff] px-3 py-3 text-[12px] leading-snug text-[#63758d]">
                Aucune geofence personnalisee pour le moment.
              </p>
            ) : null}
          </div>
        </div>      </aside>

      <aside className="border-r border-[#dfe6ee] bg-[#fbfdff] px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-black">
              {selectedContinent || "Pays"}
            </h2>
            <p className="mt-1 text-[12px] text-[#63758d]">
              Selectionnez un pays pour afficher ses geofences.
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#52657d] ring-1 ring-[#dfe6ee]">
            {countriesInContinent.length}
          </span>
        </div>

        <label className="relative mt-4 block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]"
            size={15}
          />
          <input
            value={countrySearch}
            onChange={(event) => setCountrySearch(event.target.value)}
            className="h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
            placeholder="Rechercher un pays..."
            type="search"
          />
        </label>

        <div className="mt-4 max-h-[32vh] space-y-2 overflow-y-auto pr-1">
          {countriesInContinent.map((country) => (
            <button
              key={`country-${country.id}`}
              type="button"
              onClick={() => {
                setSelectedCountryId(country.id);
                setSelectedGeofenceId(null);
                setCountryPresetGeofence(null);
              }}
              className={`w-full rounded-[7px] border px-3 py-3 text-left transition ${
                selectedCountryId === country.id
                  ? "border-[#2A9D90] bg-[#ecfdf5]"
                  : "border-[#e3e9f0] bg-white hover:border-[#b7c4d1]"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-[#0f172a]">
                  {country.name}
                </span>
                <span className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-[10px] font-semibold text-[#52657d]">
                  {country.countryCode ?? country.type}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-[#dfe6ee] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-black">
                Geofences dans {selectedCountry?.name ?? "le pays"}
              </h3>
              <p className="mt-1 text-[12px] text-[#63758d]">
                Limite du pays et geofences enregistrees.
              </p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#52657d] ring-1 ring-[#dfe6ee]">
              {countryGeofences.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {countryGeofences.map((geofence) => (
              <article
                key={`geofence-${geofence.id}`}
                className={`rounded-[8px] border p-3 transition ${
                  selectedGeofenceId === geofence.id
                    ? "border-[#2A9D90] bg-[#ecfdf5]"
                    : "border-[#e3e9f0] bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedGeofenceId(geofence.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-[#0f172a]">
                        {geofence.name}
                      </p>
                      <p className="mt-1 text-[11px] text-[#718096]">
                        {geofence.number} - {geofence.area}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d]">
                      actif
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-[#52657d]">
                    {geofence.description}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#52657d]">
                    {geofence.shapeType === "circle" ? (
                      <Circle size={13} />
                    ) : geofence.shapeType === "route" ? (
                      <Route size={13} />
                    ) : (
                      <MapPin size={13} />
                    )}
                    {geofence.source === "boundary" ? "Geofence du pays" : "Geofences personnalisees"}
                  </div>
                </button>
                {selectedGeofenceId === geofence.id ? (
                  <UnlockPermissionStatus
                    geofence={geofence}
                    editable={geofence.source === "custom"}
                    isEditing={editingGeofenceId === geofence.id}
                    isSaving={savingGeofenceId === geofence.id}
                    draftAllowed={draftLockAccessAllowed}
                    onEdit={() => startEditGeofence(geofence)}
                    onCancel={cancelEditGeofence}
                    onDraftChange={setDraftLockAccessAllowed}
                    onSave={() => updateGeofencePermission(geofence)}
                  />
                ) : null}
              </article>
            ))}

            {selectedCountry && countryGeofences.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#cbd5e1] bg-white px-3 py-4 text-[12px] leading-snug text-[#63758d]">
                Aucune geofence disponible pour {selectedCountry.name}.
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <section className="grid min-h-[calc(100vh-56px)] grid-rows-[auto_1fr_auto]">
        <div className="flex flex-col justify-between gap-3 border-b border-[#dfe6ee] bg-white px-5 py-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-[18px] font-bold text-black">
              {selectedCountry?.name ?? "Carte des geofences"}
            </h2>
            <p className="mt-1 text-[12px] text-[#63758d]">{message}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-[7px] border border-[#dfe6ee] bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#52657d]">
              {countryGeofences.length > 0 ? (
                <ShieldCheck size={15} className="text-[#2A9D90]" />
              ) : (
                <TriangleAlert size={15} className="text-[#f97316]" />
              )}
              {mapGeofences.length} geofence
              {mapGeofences.length === 1 ? "" : "s"}
            </div>
            <Link
              href="/geofence/create"
              className="flex h-9 items-center gap-2 rounded-[7px] bg-[#111827] px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-black"
            >
              <Plus size={14} />
              Creer une geofence
            </Link>
          </div>
        </div>

        <div className="relative min-h-[640px]">
          <GeofenceMapShell
            savedGeofences={mapGeofences}
            selectedGeofenceId={selectedGeofenceId}
            countryCenter={mapCenter}
            countryRings={countryRings}
            lockAssets={lockAssets}
          />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe6ee] bg-white px-5 py-3 text-[11px] text-[#52657d]">
          <div className="flex flex-wrap gap-5">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#34C759]" /> Pays ({countries.length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#3b82f6]" /> Geofences ({geofences.length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#2A9D90]" /> Pays selectionne
            </span>
          </div>
          <span className="text-[11px] text-[#718096]">
            Donnees: pays et geofences enregistrees
          </span>
        </footer>
      </section>
    </div>
  );
}
