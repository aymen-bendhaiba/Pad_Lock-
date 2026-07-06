"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, PencilLine, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, cachedApiJson, clearAppCache } from "../../../lib/api";
import { GeofenceCreateMapShell } from "./geofence-create-map-shell";
import type { LatLngTuple } from "../geofence-types";

type FormeMode = "circle" | "polygon" | "route";
type EnregistrerState = "idle" | "saving" | "saved" | "error";
type LockOption = {
  id: string;
  name: string;
};

function coordinatesFromPoints(points: LatLngTuple[]) {
  return points.map(([lat, lng]) => ({ lat, lng }));
}


function geofencePayload({
  name,
  selectedLockId,
  shapeMode,
  draftPoints,
  radiusMeters,
  lockAccessAllowed,
}: {
  name: string;
  selectedLockId: string;
  shapeMode: FormeMode;
  draftPoints: LatLngTuple[];
  radiusMeters: number;
  lockAccessAllowed: boolean;
}) {
  const accessMode = lockAccessAllowed ? "allow_inside" : "allow_outside";
  const rules = {
    lockAccessAllowed,
    rfidAllowed: true,
    smsAllowed: true,
    gprsAllowed: true,
    serialAllowed: true,
    bluetoothAllowed: true,
  };
  const terminalIds = [selectedLockId];

  if (shapeMode === "circle") {
    return {
      name,
      shapeType: "circle",
      coordinates: coordinatesFromPoints(draftPoints.slice(0, 1)),
      radiusMeters,
      accessMode,
      rules,
      terminalIds,
    };
  }

  if (shapeMode === "route") {
    return {
      name,
      shapeType: "route",
      coordinates: coordinatesFromPoints(draftPoints),
      radiusMeters: 100,
      accessMode,
      rules,
      terminalIds,
    };
  }

  return {
    name,
    shapeType: "polygon",
    coordinates: coordinatesFromPoints(draftPoints),
    accessMode,
    rules,
    terminalIds,
  };
}

function rowsFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.items, record.results, record.devices, record.locks, record.rows];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
    }
  }

  return [];
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function normalizeLockOption(record: Record<string, unknown>, index: number): LockOption | null {
  const id = textValue(
    record.terminalId,
    record.terminalID,
    record.deviceId,
    record.lockId,
    record.imei,
    record.serial,
    record.id,
  );

  if (!id) {
    return null;
  }

  const name = textValue(
    record.assetName,
    record.deviceName,
    record.lockName,
    record.name,
    record.label,
    record.displayName,
  );

  return {
    id,
    name: name || `PadLock ${id || index + 1}`,
  };
}

function uniqueLockOptions(rows: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const options: LockOption[] = [];

  rows.forEach((row, index) => {
    const option = normalizeLockOption(row, index);
    if (!option || seen.has(option.id)) return;
    seen.add(option.id);
    options.push(option);
  });

  return options;
}

export function GeofenceCreateWorkspace() {
  const router = useRouter();
  const [shapeMode, setFormeMode] = useState<FormeMode | null>(null);
  const [isDessinering, setIsDessinering] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLngTuple[]>([]);
  const [cercleRayonMeters, setCircleRayonMeters] = useState(85000);
  const [name, setName] = useState("");
  const [lockOptions, setLockOptions] = useState<LockOption[]>([]);
  const [selectedLockId, setSelectedLockId] = useState("");
  const [locksLoading, setLocksLoading] = useState(true);
  const [lockAccessAllowed, setLockAccessAllowed] = useState(true);
  const [saveState, setEnregistrerState] = useState<EnregistrerState>("idle");
  const [saveMessage, setEnregistrerMessage] = useState("");

  const areaText = useMemo(() => {
    if (draftPoints.length < 2) {
      return "000 km";
    }

    return `${String(Math.max(1, draftPoints.length * 24)).padStart(3, "0")} km`;
  }, [draftPoints.length]);

  useEffect(() => {
    let active = true;

    async function loadLocks() {
      setLocksLoading(true);

      try {
        const [devicesPayload, locksPayload] = await Promise.all([
          cachedApiJson<unknown>("/devices").catch(() => null),
          cachedApiJson<unknown>("/locks").catch(() => null),
        ]);

        if (!active) return;

        const options = uniqueLockOptions([
          ...rowsFromPayload(devicesPayload),
          ...rowsFromPayload(locksPayload),
        ]);

        setLockOptions(options);
        setSelectedLockId((current) => current || options[0]?.id || "");
      } finally {
        if (active) {
          setLocksLoading(false);
        }
      }
    }

    loadLocks();

    return () => {
      active = false;
    };
  }, []);

  function resetDraft() {
    setFormeMode(null);
    setIsDessinering(false);
    setDraftPoints([]);
    setCircleRayonMeters(85000);
    setName("");
    setLockAccessAllowed(true);
    setEnregistrerState("idle");
    setEnregistrerMessage("");
  }

  function chooseForme(mode: FormeMode) {
    setFormeMode((current) => {
      const nextMode = current === mode ? null : mode;
      setDraftPoints([]);
      setCircleRayonMeters(85000);
      setIsDessinering(false);
      setEnregistrerState("idle");
      setEnregistrerMessage("");
      return nextMode;
    });
  }

  function startDessinering() {
    if (!shapeMode) return;

    setDraftPoints([]);
    setIsDessinering(true);
    setEnregistrerState("idle");
    setEnregistrerMessage(
      shapeMode === "circle"
        ? "Cliquez sur la carte pour placer le centre du cercle. Deplacez le point si besoin."
        : shapeMode === "route"
          ? "Cliquez sur la carte pour tracer la ligne. Deplacez les points si besoin."
          : "Cliquez sur la carte pour dessiner le polygone. Deplacez les points si besoin.",
    );
  }

  async function saveGeofence() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setEnregistrerState("error");
      setEnregistrerMessage("Le nom est obligatoire.");
      return;
    }

    if (!shapeMode) {
      setEnregistrerState("error");
      setEnregistrerMessage("Choisissez une forme avant de dessiner.");
      return;
    }

    if (!selectedLockId) {
      setEnregistrerState("error");
      setEnregistrerMessage("Selectionnez le PadLock concerne par cette geofence.");
      return;
    }

    const minimumPoints = shapeMode === "circle" ? 1 : shapeMode === "route" ? 2 : 3;

    if (draftPoints.length < minimumPoints) {
      setEnregistrerState("error");
      setEnregistrerMessage(
        shapeMode === "circle"
          ? "Placez le centre du cercle sur la carte."
          : shapeMode === "route"
            ? "Placez au moins 2 points pour tracer la ligne."
            : "Placez au moins 3 points pour dessiner le polygone.",
      );
      return;
    }

    setEnregistrerState("saving");
    setEnregistrerMessage("Enregistrement de la geofence...");

    const response = await apiFetch("/geofences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geofencePayload({
        name: trimmedName,
        selectedLockId,
        shapeMode,
        draftPoints,
        radiusMeters: cercleRayonMeters,
        lockAccessAllowed,
      })),
    });

    if (!response.ok) {
      setEnregistrerState("error");
      setEnregistrerMessage("La geofence n'a pas pu etre enregistree. Verifiez les informations puis reessayez.");
      return;
    }

    clearAppCache();
    setEnregistrerState("saved");
    setEnregistrerMessage("Geofence enregistree. Retour a la liste...");
    window.setTimeout(() => router.push("/geofence"), 700);
  }

  return (
    <div className="grid min-h-[calc(100vh-56px)] grid-rows-[auto_1fr_auto] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#dfe6ee] px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-black">
            Gestion des geofences
          </h1>
          <p className="mt-1 text-[12px] text-[#63758d]">
            Creez et suivez les zones de controle de vos PadLock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetDraft}
            className="h-9 rounded-[7px] bg-[#f3f6fa] px-4 text-[12px] font-semibold text-[#334155] transition hover:bg-[#e8eef5]"
          >
            Reinitialiser
          </button>
          <button
            type="button"
            onClick={saveGeofence}
            disabled={saveState === "saving"}
            className="flex h-9 items-center gap-2 rounded-[7px] bg-black px-4 text-[12px] font-semibold text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={14} />
            {saveState === "saving" ? "Enregistrement" : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-r border-[#dfe6ee] bg-white px-5 py-4">
          <Link
            href="/geofence"
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-[#f3f6fa] px-3 text-[12px] font-semibold text-[#334155] transition hover:bg-[#e8eef5]"
          >
            <ChevronLeft size={14} />
            Retour
          </Link>

          <form className="mt-5 space-y-4" onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="text-[12px] font-bold text-[#0f172a]">Nom*</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-[7px] border border-[#dfe6ee] px-3 text-[12px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                placeholder="Nom de la geofence"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-bold text-[#0f172a]">PadLock concerne*</span>
              <select
                value={selectedLockId}
                onChange={(event) => setSelectedLockId(event.target.value)}
                disabled={locksLoading || lockOptions.length === 0}
                className="mt-1.5 h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white px-3 text-[12px] outline-none transition focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#8190a5]"
              >
                {locksLoading ? (
                  <option>Chargement des PadLock...</option>
                ) : lockOptions.length ? (
                  lockOptions.map((lock) => (
                    <option key={lock.id} value={lock.id}>
                      {lock.name}
                    </option>
                  ))
                ) : (
                  <option>Aucun PadLock trouve</option>
                )}
              </select>
            </label>

            <div>
              <span className="text-[12px] font-bold text-[#0f172a]">Forme</span>
              <div className="mt-2 flex items-center gap-4 text-[13px] text-[#0f172a]">
                {(["circle", "polygon", "route"] as FormeMode[]).map((mode) => (
                  <label key={mode} className="flex items-center gap-2">
                    <input
                      checked={shapeMode === mode}
                      onChange={() => chooseForme(mode)}
                      type="checkbox"
                      className="size-4 accent-[#111827]"
                    />
                    <span className="capitalize">{mode === "route" ? "ligne" : mode === "circle" ? "cercle" : "polygone"}</span>
                  </label>
                ))}
              </div>
            </div>

            {shapeMode ? (
              <button
                type="button"
                onClick={startDessinering}
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-[7px] px-3 text-[12px] font-semibold transition ${
                  isDessinering
                    ? "bg-[#ecfdf5] text-[#047857] ring-1 ring-[#2A9D90]"
                    : "bg-[#111827] text-white hover:bg-black"
                }`}
              >
                <PencilLine size={14} />
                {isDessinering ? "Dessin active" : "Dessiner"}
              </button>
            ) : null}

            {shapeMode === "circle" && draftPoints[0] ? (
              <label className="block">
                <span className="flex items-center justify-between text-[12px] font-bold text-[#0f172a]">
                  Rayon
                  <span className="text-[11px] font-semibold text-[#63758d]">
                    {(cercleRayonMeters / 1000).toFixed(1)} km
                  </span>
                </span>
                <input
                  value={cercleRayonMeters}
                  onChange={(event) => setCircleRayonMeters(Number(event.target.value))}
                  type="range"
                  min={1000}
                  max={250000}
                  step={1000}
                  className="mt-2 w-full accent-[#111827]"
                />
                <input
                  value={Math.round(cercleRayonMeters / 1000)}
                  onChange={(event) => setCircleRayonMeters(Math.max(1, Number(event.target.value) || 1) * 1000)}
                  type="number"
                  min={1}
                  className="mt-2 h-9 w-full rounded-[7px] border border-[#dfe6ee] px-3 text-[12px] outline-none transition focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                />
              </label>
            ) : null}

            <div className="rounded-[8px] border border-[#dfe6ee] bg-[#fbfdff] p-3">
              <span className="text-[12px] font-bold text-[#0f172a]">Autorisation dans cette zone</span>
              <div className="mt-2 space-y-2 text-[12px] text-[#0f172a]">
                <label className="flex items-start gap-2 rounded-[7px] bg-white px-3 py-2 ring-1 ring-[#e3e9f0]">
                  <input
                    checked={lockAccessAllowed}
                    onChange={() => setLockAccessAllowed(true)}
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[#111827]"
                  />
                  <span>
                    <span className="block font-semibold">Deverrouillage autorise</span>
                    <span className="block text-[11px] text-[#63758d]">Le PadLock peut etre deverrouille dans cette zone.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-[7px] bg-white px-3 py-2 ring-1 ring-[#e3e9f0]">
                  <input
                    checked={!lockAccessAllowed}
                    onChange={() => setLockAccessAllowed(false)}
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[#111827]"
                  />
                  <span>
                    <span className="block font-semibold">Deverrouillage bloque</span>
                    <span className="block text-[11px] text-[#63758d]">Le PadLock ne peut pas etre deverrouille dans cette zone.</span>
                  </span>
                </label>
              </div>
            </div>

            {shapeMode !== "circle" ? (
              <label className="block">
                <span className="text-[12px] font-bold text-[#0f172a]">
                  {shapeMode === "route" ? "Longueur de la ligne" : "Surface"}
                </span>
                <input
                  className="mt-1.5 h-10 w-full rounded-[7px] border border-[#dfe6ee] px-3 text-[12px] outline-none transition placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                  value={areaText}
                  readOnly
                />
              </label>
            ) : null}

            {saveMessage ? (
              <p
                className={`rounded-[7px] px-3 py-2 text-[12px] ${
                  saveState === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-[#ecfdf5] text-[#047857]"
                }`}
              >
                {saveMessage}
              </p>
            ) : null}
          </form>
        </aside>

        <section className="relative min-h-[620px]">
          <GeofenceCreateMapShell
            draftPoints={draftPoints}
            shapeMode={shapeMode}
            isDrawing={isDessinering}
            circleRadiusMeters={cercleRayonMeters}
            onDraftPointsChange={setDraftPoints}
          />
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe6ee] bg-white px-5 py-3 text-[11px] text-[#52657d]">
        <div className="flex flex-wrap gap-5">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#34C759]" /> Tous (253)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#3b82f6]" /> Mouvement (172)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#f97316]" /> A l'arret (56)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#94a3b8]" /> Hors ligne (32)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#ef4444]" /> Alarmes (12)
          </span>
        </div>
        <div className="flex flex-wrap gap-5">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#b7791f]" /> Verrouilles (322)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#9ae6b4]" /> Deverrouilles (72)
          </span>
        </div>
      </footer>
    </div>
  );
}
