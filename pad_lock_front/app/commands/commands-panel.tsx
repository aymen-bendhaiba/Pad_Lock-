
"use client";

import {
  BatteryMedium,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Truck,
  Unlock,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, cachedApiJson } from "../../lib/api";
import { userFriendlyError } from "../../lib/error-messages";

const tabs = ["Device Status", "Unlock Devices", "Low Battery", "Sleep Mode", "Password", "Phone Number", "Add RFID"] as const;
const emptyPhoneSlots = () => Array.from({ length: 5 }, () => ({ phoneNumber: "" }));

type Tab = (typeof tabs)[number];
type ApiRecord = Record<string, unknown>;
type CommandState = "idle" | "loading" | "success" | "error";

type CommandDevice = {
  terminalId: string;
  name: string;
  battery: string;
  batteryValue: number | null;
  status: "Moving" | "Idle" | "Offline" | "Alarm";
  lock: "Locked" | "Unlocked" | "Unknown";
};

type CommandResult = { state: CommandState; message: string };
type PhoneSlot = { phoneNumber: string };
type RfidCard = { cardNumber: string; label?: string; role?: string; isAdmin?: boolean };

function rowsFromPayload(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is ApiRecord => Boolean(row) && typeof row === "object");
  }

  if (payload && typeof payload === "object") {
    const record = payload as ApiRecord;

    for (const key of ["data", "items", "results", "devices", "locks", "cards", "rows"]) {
      const value = record[key];

      if (Array.isArray(value)) {
        return value.filter((row): row is ApiRecord => Boolean(row) && typeof row === "object");
      }
    }
  }

  return [];
}

function nestedRecord(record: ApiRecord | null | undefined, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as ApiRecord;
    }
  }

  return null;
}

function containers(record: ApiRecord | null | undefined) {
  if (!record) return [];

  return [
    record,
    nestedRecord(record, ["position", "lastPosition", "latestPosition", "telemetry", "status", "device", "lock", "data"]),
  ].filter(Boolean) as ApiRecord[];
}

function readString(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of containers(record)) {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
  }

  return undefined;
}

function readNumber(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of containers(record)) {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
  }

  return undefined;
}

function readBoolean(record: ApiRecord | null | undefined, keys: string[]) {
  for (const source of containers(record)) {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (["true", "locked", "online", "moving"].includes(normalized)) return true;
        if (["false", "unlocked", "offline", "idle"].includes(normalized)) return false;
      }
    }
  }

  return undefined;
}

function terminalId(record: ApiRecord) {
  return readString(record, ["terminalId", "terminalID", "deviceId", "lockId", "id", "serial", "imei"]) ?? "unknown";
}

function keyByTerminal(rows: ApiRecord[]) {
  return new Map(rows.map((row) => [terminalId(row), row]));
}

function normalizeBattery(record: ApiRecord, lock?: ApiRecord) {
  const raw = readString(record, ["battery", "batteryLevel", "power", "batteryPercent"])
    ?? readString(lock, ["battery", "batteryLevel", "power", "batteryPercent"]);
  const matchValue = raw?.match(/\d+(?:\.\d+)?/)?.[0];
  const value = readNumber(record, ["battery", "batteryLevel", "power", "batteryPercent"])
    ?? readNumber(lock, ["battery", "batteryLevel", "power", "batteryPercent"])
    ?? (matchValue ? Number(matchValue) : undefined);

  if (value === undefined) return { label: "--", value: null };

  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  return { label: String(normalized).padStart(2, "0") + "%", value: normalized };
}

function normalizeLock(record: ApiRecord, lock?: ApiRecord): CommandDevice["lock"] {
  const raw = readString(record, ["lock", "lockState", "locked", "statusLock"])
    ?? readString(lock, ["lock", "lockState", "locked", "statusLock"]);
  const locked = readBoolean(record, ["locked", "isLocked"])
    ?? readBoolean(lock, ["locked", "isLocked"]);

  if (locked === true || raw?.toLowerCase() === "locked") return "Locked";
  if (locked === false || raw?.toLowerCase() === "unlocked") return "Unlocked";
  return "Unknown";
}

function normalizeStatus(record: ApiRecord, lock?: ApiRecord): CommandDevice["status"] {
  const raw = readString(record, ["status", "state", "movementStatus", "motion", "online"])
    ?? readString(lock, ["status", "state", "movementStatus", "motion", "online"]);
  const online = readBoolean(record, ["online", "isOnline", "connected"])
    ?? readBoolean(lock, ["online", "isOnline", "connected"]);

  if (raw) {
    const status = raw.toLowerCase();
    if (status.includes("alarm") || status.includes("alert")) return "Alarm";
    if (status.includes("moving") || status.includes("motion")) return "Moving";
    if (status.includes("idle") || status.includes("stopped")) return "Idle";
    if (status.includes("offline") || status.includes("disconnected")) return "Offline";
  }

  return online === false ? "Offline" : "Moving";
}

function normalizeDevice(record: ApiRecord, lock?: ApiRecord): CommandDevice {
  const id = terminalId(record);
  const battery = normalizeBattery(record, lock);

  return {
    terminalId: id,
    name: readString(record, ["name", "assetName", "deviceName", "label"])
      ?? readString(lock, ["name", "assetName", "deviceName", "label"])
      ?? "Cadenas-" + id,
    battery: battery.label,
    batteryValue: battery.value,
    status: normalizeStatus(record, lock),
    lock: normalizeLock(record, lock),
  };
}

function normalizeRfidCards(payload: unknown): RfidCard[] {
  return rowsFromPayload(payload).map((record) => {
    const role = readString(record, ["role", "accessRole", "type"]);
    const adminFlag = readBoolean(record, ["isAdmin", "admin"]);

    return {
      cardNumber: readString(record, ["cardNumber", "card", "number", "id"]) ?? "",
      label: readString(record, ["label", "name"]),
      role,
      isAdmin: adminFlag === true || role?.toLowerCase() === "admin",
    };
  }).filter((card) => card.cardNumber);
}

function batteryColor(value: number | null) {
  if (value === null) return "text-[#94a3b8]";
  if (value <= 10) return "text-[#ef4444]";
  if (value <= 55) return "text-[#eab308]";
  return "text-[#059669]";
}

function statusLabel(value: CommandDevice["status"]) {
  if (value === "Moving") return "En mouvement";
  if (value === "Idle") return "Ã€ l'arret";
  if (value === "Offline") return "Hors ligne";
  return "Alerte";
}

function rfidRole(deviceId: string, roles: Record<string, boolean>) {
  return roles[deviceId] ? "admin" : "limited";
}

function rfidCardClass(card: RfidCard) {
  return card.isAdmin || card.role?.toLowerCase() === "admin"
    ? "border-[#2A9D90] bg-[#ecfdf5] text-[#065f46]"
    : "border-[#dfe6ee] bg-white text-[#111827]";
}

function resultClass(state: CommandState) {
  if (state === "success") return "bg-[#ecfdf5] text-[#047857]";
  if (state === "error") return "bg-red-50 text-red-700";
  if (state === "loading") return "bg-[#eef4fa] text-[#334155]";
  return "hidden";
}

function DeviceMeta({ device }: { device: CommandDevice }) {
  return (
    <div className="flex w-[110px] shrink-0 items-center gap-4">
      <span className={"flex items-center gap-1.5 " + batteryColor(device.batteryValue)}>
        <BatteryMedium size={13} />
        {device.battery}
      </span>
    </div>
  );
}

function SaveButton({ loading, children = "Enregistrer" }: { loading?: boolean; children?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-8 items-center justify-center gap-1.5 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function StatusMessage({ result }: { result?: CommandResult }) {
  if (!result || result.state === "idle") return null;

  return <p className={"rounded-[6px] px-2.5 py-1.5 text-[11px] font-medium " + resultClass(result.state)}>{result.message}</p>;
}

function DeviceIdentity({ device }: { device: CommandDevice }) {
  return (
    <span className="flex min-w-[220px] flex-1 items-center gap-2 font-bold">
      <Truck size={13} className="shrink-0 text-[#64748b]" />
      <span className="min-w-0">
        <span className="block truncate">{device.name}</span>
        <span className="block truncate text-[10px] font-medium text-[#64748b]">{device.terminalId}</span>
      </span>
    </span>
  );
}

function Pager({ page, pageCount, rowsPerPage, total, onPageChange, onRowsPerPageChange }: {
  page: number;
  pageCount: number;
  rowsPerPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 px-4 py-4 text-[12px] text-[#64748b] md:flex-row md:items-center">
      <span>{total} equipement(s).</span>
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-semibold text-[#111827]">Lignes par page</span>
        <select
          value={rowsPerPage}
          onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
          className="h-8 rounded-[6px] border border-[#dfe6ee] bg-white px-3 outline-none"
        >
          {[5, 10, 20].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
        <span className="font-semibold text-[#111827]">Page {page} sur {pageCount}</span>
        <div className="flex gap-2">
          {[
            { Icon: ChevronsLeft, page: 1 },
            { Icon: ChevronLeft, page: Math.max(1, page - 1) },
            { Icon: ChevronRight, page: Math.min(pageCount, page + 1) },
            { Icon: ChevronsRight, page: pageCount },
          ].map(({ Icon, page: nextPage }, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onPageChange(nextPage)}
              disabled={nextPage === page}
              className="grid size-8 place-items-center rounded-[6px] bg-white text-[#64748b] disabled:text-[#cbd5e1]"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterLegend({ devices }: { devices: CommandDevice[] }) {
  const stats = {
    all: devices.length,
    moving: devices.filter((device) => device.status === "Moving").length,
    idle: devices.filter((device) => device.status === "Idle").length,
    offline: devices.filter((device) => device.status === "Offline").length,
    alarm: devices.filter((device) => device.status === "Alarm").length,
    locked: devices.filter((device) => device.lock === "Locked").length,
    unlocked: devices.filter((device) => device.lock === "Unlocked").length,
  };

  return (
    <div className="flex flex-wrap justify-between gap-3 px-3 py-3 text-[11px] text-[#64748b]">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#34C759]" />Tous ({stats.all})</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#3b82f6]" />Mouvement ({stats.moving})</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#f97316]" />Arret ({stats.idle})</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#94a3b8]" />Hors ligne ({stats.offline})</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ef4444]" />Alerte ({stats.alarm})</span>
      </div>
      <div className="flex gap-x-6">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#a16207]" />Verrouilles : ({stats.locked})</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#a7f3d0]" />Deverrouilles : ({stats.unlocked})</span>
      </div>
    </div>
  );
}

export function CommandsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("Device Status");
  const [devices, setDevices] = useState<CommandDevice[]>([]);
  const [loadState, setLoadState] = useState<CommandState>("loading");
  const [loadMessage, setLoadMessage] = useState("Chargement des equipements...");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [results, setResults] = useState<Record<string, CommandResult>>({});
  const [batteryValues, setBatteryValues] = useState<Record<string, string>>({});
  const [sleepValues, setSleepValues] = useState<Record<string, string>>({});
  const [sleepEnabled, setSleepEnabled] = useState<Record<string, boolean>>({});
  const [passwordValues, setPasswordValues] = useState<Record<string, { current: string; next: string }>>({});
  const [unlockPasswords, setUnlockPasswords] = useState<Record<string, string>>({});
  const [phoneValues, setPhoneValues] = useState<Record<string, PhoneSlot[]>>({});
  const [phoneLoaded, setPhoneLoaded] = useState<Record<string, boolean>>({});
  const phoneLoadingRef = useRef<Set<string>>(new Set());
  const [expandedRfid, setExpandedRfid] = useState<string | null>(null);
  const [rfidCards, setRfidCards] = useState<Record<string, RfidCard[]>>({});
  const [rfidInputs, setRfidInputs] = useState<Record<string, string>>({});
  const [rfidAdminRoles, setRfidAdminRoles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timers = Object.entries(results)
      .filter(([key, result]) => key.startsWith("rfid-") && (result.state === "success" || result.state === "error"))
      .map(([key]) => window.setTimeout(() => {
        setResults((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }, 3000));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [results]);

  useEffect(() => {
    let isMounted = true;

    async function loadDevices() {
      setLoadState("loading");

      try {
        const [devicesPayload, locksPayload] = await Promise.all([
          cachedApiJson("/devices", true).catch(() => []),
          cachedApiJson("/locks", true).catch(() => []),
        ]);
        const locks = rowsFromPayload(locksPayload);
        const locksByTerminal = keyByTerminal(locks);
        const deviceRows = rowsFromPayload(devicesPayload);
        const sourceRows = deviceRows.length ? deviceRows : locks;
        const nextDevices = sourceRows
          .map((row) => normalizeDevice(row, locksByTerminal.get(terminalId(row))))
          .filter((device) => device.terminalId !== "unknown");

        if (!isMounted) return;

        setDevices(nextDevices);
        setLoadState("success");
        setLoadMessage(nextDevices.length ? String(nextDevices.length) + " equipement(s) charge(s)." : "Aucun equipement disponible pour le moment.");
      } catch {
        if (!isMounted) return;
        setLoadState("error");
        setLoadMessage("Impossible de charger les equipements. Verifiez votre connexion et votre session.");
      }
    }

    loadDevices();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, query, rowsPerPage]);

  const filteredDevices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return devices.filter((device) =>
      normalizedQuery
        ? [device.name, device.terminalId, device.status, device.lock].some((value) => value.toLowerCase().includes(normalizedQuery))
        : true,
    );
  }, [devices, query]);

  const pageCount = Math.max(1, Math.ceil(filteredDevices.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pagedDevices = filteredDevices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    if (activeTab !== "Phone Number") return;

    pagedDevices.forEach((device) => {
      if (!phoneLoaded[device.terminalId]) {
        void loadPhoneNumbers(device.terminalId);
      }
    });
  }, [activeTab, pagedDevices, phoneLoaded]);


  function resultKey(action: string, terminalIdValue: string) {
    return action + ":" + terminalIdValue;
  }

  function getResult(action: string, terminalIdValue: string) {
    return results[resultKey(action, terminalIdValue)];
  }

  function commandLoading(action: string, terminalIdValue: string) {
    return getResult(action, terminalIdValue)?.state === "loading";
  }

  async function runCommand(action: string, terminalIdValue: string, path: string, body: Record<string, unknown>, successMessage: string) {
    const key = resultKey(action, terminalIdValue);
    setResults((current) => ({ ...current, [key]: { state: "loading", message: "Envoi de la commande..." } }));

    try {
      const response = await apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(userFriendlyError(payload, "La commande n'a pas pu etre executee."));
      }

      setResults((current) => ({
        ...current,
        [key]: { state: "success", message: successMessage },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [key]: { state: "error", message: userFriendlyError(error, "La commande n'a pas pu etre executee.") },
      }));
    }
  }

  async function loadRfidCards(terminalIdValue: string, force = false) {
    if (!force && rfidCards[terminalIdValue]) return;

    const key = resultKey("rfid-load", terminalIdValue);
    setResults((current) => ({ ...current, [key]: { state: "loading", message: "Chargement des badges RFID..." } }));

    try {
      const payload = await cachedApiJson("/locks/" + encodeURIComponent(terminalIdValue) + "/rfid-cards", true);
      setRfidCards((current) => ({ ...current, [terminalIdValue]: normalizeRfidCards(payload) }));
      setResults((current) => ({ ...current, [key]: { state: "success", message: "Badges RFID charges." } }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [key]: { state: "error", message: userFriendlyError(error, "Impossible de charger les badges RFID.") },
      }));
    }
  }

  async function addRfid(device: CommandDevice) {
    const card = rfidInputs[device.terminalId]?.trim();

    if (!/^\d{10}$/.test(card ?? "")) {
      setResults((current) => ({
        ...current,
        [resultKey("rfid-add", device.terminalId)]: { state: "error", message: "Le badge RFID doit contenir exactement 10 chiffres." },
      }));
      return;
    }

    await runCommand(
      "rfid-add",
      device.terminalId,
      "/locks/" + encodeURIComponent(device.terminalId) + "/rfid-cards",
      { cards: [card], role: rfidRole(device.terminalId, rfidAdminRoles) },
      "Badge RFID ajoute.",
    );
    setRfidInputs((current) => ({ ...current, [device.terminalId]: "" }));
    setRfidAdminRoles((current) => ({ ...current, [device.terminalId]: false }));
    await loadRfidCards(device.terminalId, true);
  }

  async function deleteRfid(device: CommandDevice, cardNumber: string) {
    const key = resultKey("rfid-delete", device.terminalId);
    setResults((current) => ({ ...current, [key]: { state: "loading", message: "Suppression du badge RFID..." } }));

    try {
      const response = await apiFetch("/locks/" + encodeURIComponent(device.terminalId) + "/rfid-cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: [cardNumber] }),
      });

      if (!response.ok) throw new Error("Impossible de supprimer le badge RFID.");

      setResults((current) => ({ ...current, [key]: { state: "success", message: "Badge RFID supprime." } }));
      await loadRfidCards(device.terminalId, true);
    } catch (error) {
      setResults((current) => ({
        ...current,
        [key]: { state: "error", message: userFriendlyError(error, "Impossible de supprimer le badge RFID.") },
      }));
    }
  }

  async function loadPhoneNumbers(terminalIdValue: string, force = false) {
    if (!force && phoneLoaded[terminalIdValue]) return;
    if (phoneLoadingRef.current.has(terminalIdValue)) return;

    phoneLoadingRef.current.add(terminalIdValue);
    const key = resultKey("phone-load", terminalIdValue);
    setResults((current) => ({ ...current, [key]: { state: "loading", message: "Chargement des numeros..." } }));

    try {
      const response = await apiFetch("/vip/phone?terminalId=" + encodeURIComponent(terminalIdValue), { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { phones?: unknown } | null;
      if (!response.ok) throw new Error(userFriendlyError(payload, "Impossible de charger les numeros de telephone."));

      const next = emptyPhoneSlots();
      const rows = Array.isArray(payload?.phones) ? payload.phones : [];
      rows.slice(0, 5).forEach((row, fallbackIndex) => {
        const record = row && typeof row === "object" ? row as ApiRecord : null;
        const rawIndex = Number(record?.index);
        const index = Number.isInteger(rawIndex) && rawIndex >= 1 && rawIndex <= 5 ? rawIndex - 1 : fallbackIndex;
        const phoneNumber = readString(record, ["phoneNumber", "number", "phone", "value"]) ?? "";
        next[index] = { phoneNumber };
      });

      setPhoneValues((current) => ({ ...current, [terminalIdValue]: next }));
      setPhoneLoaded((current) => ({ ...current, [terminalIdValue]: true }));
      setResults((current) => ({ ...current, [key]: { state: "success", message: "Numeros charges." } }));
    } catch (error) {
      setPhoneLoaded((current) => ({ ...current, [terminalIdValue]: true }));
      setResults((current) => ({
        ...current,
        [key]: { state: "error", message: userFriendlyError(error, "Impossible de charger les numeros de telephone.") },
      }));
    } finally {
      phoneLoadingRef.current.delete(terminalIdValue);
    }
  }

  function updatePhone(id: string, index: number, nextSlot: PhoneSlot) {
    setPhoneValues((current) => {
      const next = [...(current[id] ?? emptyPhoneSlots())];
      next[index] = nextSlot;
      return { ...current, [id]: next };
    });
  }

  async function deletePhoneNumber(terminalIdValue: string, index: number) {
    const key = resultKey("phone-delete-" + index, terminalIdValue);
    setResults((current) => ({ ...current, [key]: { state: "loading", message: "Suppression du numero..." } }));

    try {
      const response = await apiFetch("/vip/phone?terminalId=" + encodeURIComponent(terminalIdValue) + "&index=" + String(index + 1), { method: "DELETE" });
      const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
      if (!response.ok) throw new Error(userFriendlyError(payload, "Impossible de supprimer ce numero."));

      setPhoneValues((current) => {
        const next = [...(current[terminalIdValue] ?? emptyPhoneSlots())];
        next[index] = { phoneNumber: "" };
        return { ...current, [terminalIdValue]: next };
      });
      setPhoneLoaded((current) => ({ ...current, [terminalIdValue]: true }));
      setResults((current) => ({ ...current, [key]: { state: "success", message: "Numero supprime." } }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [key]: { state: "error", message: userFriendlyError(error, "Impossible de supprimer ce numero.") },
      }));
    }
  }

  function unlockDevice(device: CommandDevice) {
    const password = unlockPasswords[device.terminalId]?.trim();
    if (!password) {
      setResults((current) => ({
        ...current,
        [resultKey("remote-unlock", device.terminalId)]: { state: "error", message: "Le mot de passe de deverrouillage est obligatoire." },
      }));
      return;
    }
    runCommand("remote-unlock", device.terminalId, "/unlock", { terminalId: device.terminalId, password }, "Commande de deverrouillage envoyee.");
  }

  const titles: Record<Tab, [string, string]> = {
    "Device Status": ["Etat des equipements", "Consultez les equipements connectes et envoyez des commandes de redemarrage."],
    "Unlock Devices": ["Deverrouillage a distance", "Deverrouillez un cadenas a distance."],
    "Low Battery": ["Seuil de batterie faible", "Definissez le seuil de batterie faible des cadenas connectes."],
    "Sleep Mode": ["Mode veille", "Activez la veille profonde et definissez le seuil de declenchement."],
    Password: ["Gestion du mot de passe", "Modifiez les mots de passe statiques de deverrouillage."],
    "Phone Number": ["Numeros de telephone", "Configurez les numeros VIP par equipement."],
    "Add RFID": ["Badges RFID", "Chargez, ajoutez et supprimez les badges RFID de chaque cadenas."],
  };

  const tabLabels: Record<Tab, string> = {
    "Device Status": "Etat",
    "Unlock Devices": "Deverrouillage",
    "Low Battery": "Batterie",
    "Sleep Mode": "Veille",
    Password: "Mot de passe",
    "Phone Number": "Telephone",
    "Add RFID": "RFID",
  };

  return (
    <div className="w-full px-4 py-7 md:px-6">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-[26px] font-bold tracking-normal text-black">Commandes et controle des equipements</h1>
          <p className="mt-2 text-[13px] text-[#64748b]">Gerez les cadenas connectes et envoyez les commandes disponibles.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold text-[#334155]"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      <div className="mb-4 grid w-full max-w-[1040px] grid-cols-2 rounded-[5px] bg-[#f1f1f2] p-0.5 text-[12px] font-medium text-[#64748b] md:grid-cols-7">
        {tabs.map((tab) => (
          <button
            key={tabLabels[tab]}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={"h-8 rounded-[4px] px-3 focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/15 " + (activeTab === tab ? "bg-white text-[#111827] shadow-sm" : "")}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <section className="rounded-[8px] bg-[#eef4fa] p-4">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-[15px] font-bold">{titles[activeTab][0]}</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">{titles[activeTab][1]}</p>
          </div>
          {activeTab === "Device Status" ? (
            <button
              className="h-8 w-fit rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
              type="button"
              disabled={!filteredDevices.length}
              onClick={() => filteredDevices.forEach((device) => runCommand("restart", device.terminalId, "/restart", { terminalId: device.terminalId }, "Commande de redemarrage envoyee."))}
            >
              Tout redemarrer
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="relative block max-w-[430px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
              placeholder="Rechercher un equipement ou un terminal"
            />
          </label>
          <p className={"rounded-[6px] px-3 py-2 text-[12px] " + resultClass(loadState)}>{loadMessage}</p>
        </div>

        <div className="space-y-2">

          {pagedDevices.map((device) => {
            if (activeTab === "Device Status") {
              return (
                <div key={device.terminalId} className="flex flex-col gap-3 rounded-[6px] bg-white px-3 py-3 text-[12px] font-medium xl:flex-row xl:items-center">
                  <DeviceIdentity device={device} />
                  <DeviceMeta device={device} />
                  <span className="w-[90px] shrink-0 font-semibold text-[#64748b]">{statusLabel(device.status)}</span>
                  <div className="flex flex-wrap gap-2 xl:ml-auto">
                    <button
                      type="button"
                      onClick={() => runCommand("restart", device.terminalId, "/restart", { terminalId: device.terminalId }, "Commande de redemarrage envoyee.")}
                      disabled={commandLoading("restart", device.terminalId)}
                      className="flex h-8 items-center gap-1.5 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
                    >
                      {commandLoading("restart", device.terminalId) ? <Loader2 size={13} className="animate-spin" /> : null}
                      Redemarrer
                    </button>
                    <button
                      type="button"
                      onClick={() => runCommand("clearcache", device.terminalId, "/clearcache", { terminalId: device.terminalId }, "Commande de nettoyage du cache envoyee.")}
                      disabled={commandLoading("clearcache", device.terminalId)}
                      className="h-8 rounded-[6px] border border-[#dfe6ee] px-3 text-[12px] font-semibold text-[#334155] disabled:opacity-60"
                    >
                      Vider le cache
                    </button>
                  </div>
                  <StatusMessage result={getResult("restart", device.terminalId) ?? getResult("clearcache", device.terminalId)} />
                </div>
              );
            }

            if (activeTab === "Unlock Devices") {
              return (
                <form
                  key={device.terminalId}
                  onSubmit={(event) => {
                    event.preventDefault();
                    unlockDevice(device);
                  }}
                  className="flex flex-col gap-3 rounded-[6px] bg-white px-3 py-3 text-[12px] font-medium xl:flex-row xl:items-center"
                >
                  <DeviceIdentity device={device} />
                  <DeviceMeta device={device} />
                  <input
                    value={unlockPasswords[device.terminalId] ?? ""}
                    onChange={(event) => setUnlockPasswords((current) => ({ ...current, [device.terminalId]: event.target.value }))}
                    className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px] outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                    placeholder="Mot de passe de deverrouillage"
                    type="password"
                  />
                  <div className="flex flex-wrap gap-2 xl:ml-auto">
                    <button
                      type="submit"
                      disabled={commandLoading("remote-unlock", device.terminalId)}
                      className="flex h-8 items-center gap-1.5 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
                    >
                      {commandLoading("remote-unlock", device.terminalId) ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                      Deverrouiller
                    </button>
                  </div>
                  <StatusMessage result={getResult("remote-unlock", device.terminalId)} />
                </form>
              );
            }

            if (activeTab === "Low Battery") {
              return (
                <form
                  key={device.terminalId}
                  onSubmit={(event) => {
                    event.preventDefault();
                    runCommand("battery", device.terminalId, "/battery/threshold/set", { terminalId: device.terminalId, threshold: Number(batteryValues[device.terminalId] ?? 10) }, "Seuil de batterie enregistre.");
                  }}
                  className="flex flex-col gap-3 rounded-[6px] bg-white px-3 py-3 text-[12px] font-medium xl:flex-row xl:items-center"
                >
                  <DeviceIdentity device={device} />
                  <DeviceMeta device={device} />
                  <input
                    value={batteryValues[device.terminalId] ?? "10"}
                    onChange={(event) => setBatteryValues((current) => ({ ...current, [device.terminalId]: event.target.value }))}
                    className="h-8 w-full max-w-[220px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]"
                    min={0}
                    max={90}
                    type="number"
                    placeholder="Seuil %"
                  />
                  <SaveButton loading={commandLoading("battery", device.terminalId)} />
                  <StatusMessage result={getResult("battery", device.terminalId)} />
                </form>
              );
            }

            if (activeTab === "Sleep Mode") {
              return (
                <form
                  key={device.terminalId}
                  onSubmit={(event) => {
                    event.preventDefault();
                    runCommand("sleep", device.terminalId, "/deepsleep/set", { terminalId: device.terminalId, enabled: sleepEnabled[device.terminalId] ?? true, threshold: Number(sleepValues[device.terminalId] ?? 10) }, "Parametres de veille enregistres.");
                  }}
                  className="flex flex-col gap-3 rounded-[6px] bg-white px-3 py-3 text-[12px] font-medium xl:flex-row xl:items-center"
                >
                  <DeviceIdentity device={device} />
                  <DeviceMeta device={device} />
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      checked={sleepEnabled[device.terminalId] ?? true}
                      onChange={(event) => setSleepEnabled((current) => ({ ...current, [device.terminalId]: event.target.checked }))}
                      type="checkbox"
                    />
                    Active
                  </label>
                  <input
                    value={sleepValues[device.terminalId] ?? "10"}
                    onChange={(event) => setSleepValues((current) => ({ ...current, [device.terminalId]: event.target.value }))}
                    className="h-8 w-full max-w-[220px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]"
                    min={0}
                    type="number"
                    placeholder="Declenchement %"
                  />
                  <SaveButton loading={commandLoading("sleep", device.terminalId)} />
                  <StatusMessage result={getResult("sleep", device.terminalId)} />
                </form>
              );
            }

            if (activeTab === "Password") {
              const password = passwordValues[device.terminalId] ?? { current: "", next: "" };

              return (
                <form
                  key={device.terminalId}
                  onSubmit={(event) => {
                    event.preventDefault();
                    runCommand("password", device.terminalId, "/password/modify", { terminalId: device.terminalId, currentPassword: password.current, newPassword: password.next }, "Commande de modification du mot de passe envoyee.");
                  }}
                  className="flex flex-col gap-3 rounded-[6px] bg-white px-3 py-3 text-[12px] font-medium xl:flex-row xl:items-center"
                >
                  <DeviceIdentity device={device} />
                  <DeviceMeta device={device} />
                  <div className="flex min-w-[280px] flex-1 flex-col gap-2 md:flex-row">
                    <input value={password.current} onChange={(event) => setPasswordValues((current) => ({ ...current, [device.terminalId]: { ...password, current: event.target.value } }))} className="h-8 rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]" placeholder="Mot de passe actuel" type="password" />
                    <input value={password.next} onChange={(event) => setPasswordValues((current) => ({ ...current, [device.terminalId]: { ...password, next: event.target.value } }))} className="h-8 rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]" placeholder="Nouveau mot de passe" type="password" />
                  </div>
                  <Eye size={14} className="text-[#64748b]" />
                  <Edit3 size={14} className="text-[#64748b]" />
                  <SaveButton loading={commandLoading("password", device.terminalId)} />
                  <StatusMessage result={getResult("password", device.terminalId)} />
                </form>
              );
            }

            if (activeTab === "Phone Number") {
              const values = phoneValues[device.terminalId] ?? emptyPhoneSlots();

              return (
                <div key={device.terminalId} className="rounded-[6px] bg-white p-3 text-[12px]">
                  <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
                    <DeviceIdentity device={device} />
                    <DeviceMeta device={device} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {Array.from({ length: 5 }, (_, index) => (
                      <form
                        key={index}
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const phoneNumber = values[index]?.phoneNumber.trim();
                          if (!phoneNumber) {
                            setResults((current) => ({ ...current, [resultKey("phone-" + index, device.terminalId)]: { state: "error", message: "Le numero de telephone est obligatoire." } }));
                            return;
                          }
                          await runCommand("phone-" + index, device.terminalId, "/vip/phone/set", { terminalId: device.terminalId, index: index + 1, phoneNumber }, "Numero VIP enregistre.");
                          setPhoneLoaded((current) => ({ ...current, [device.terminalId]: true }));
                        }}
                        className="flex gap-2"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <input value={values[index]?.phoneNumber ?? ""} onChange={(event) => updatePhone(device.terminalId, index, { ...(values[index] ?? { phoneNumber: "" }), phoneNumber: event.target.value })} className="h-8 min-w-0 rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]" placeholder={"VIP " + (index + 1)} />
                          <span className="text-[10px] font-semibold text-[#64748b]">Alarmes envoyees par defaut</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <SaveButton loading={commandLoading("phone-" + index, device.terminalId)}>Definir</SaveButton>
                          <button type="button" onClick={() => deletePhoneNumber(device.terminalId, index)} disabled={commandLoading("phone-delete-" + index, device.terminalId) || !values[index]?.phoneNumber.trim()} className="grid size-8 place-items-center rounded-[6px] border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label={"Supprimer VIP " + (index + 1)}>
                            {commandLoading("phone-delete-" + index, device.terminalId) ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          </button>
                        </div>
                      </form>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <StatusMessage result={getResult("phone-load", device.terminalId)} />
                    {Array.from({ length: 5 }, (_, index) => <div key={index} className="space-y-1"><StatusMessage result={getResult("phone-" + index, device.terminalId)} /><StatusMessage result={getResult("phone-delete-" + index, device.terminalId)} /></div>)}
                  </div>
                </div>
              );
            }

            const isExpanded = expandedRfid === device.terminalId;

            return (
              <div key={device.terminalId} className="rounded-[6px] bg-white px-3 py-3 text-[12px]">
                <button
                  type="button"
                  onClick={() => {
                    const next = isExpanded ? null : device.terminalId;
                    setExpandedRfid(next);
                    if (next) loadRfidCards(device.terminalId);
                  }}
                  className="grid w-full grid-cols-[minmax(180px,1fr)_230px_minmax(80px,1fr)_24px] items-center gap-4 text-left"
                >
                  <DeviceIdentity device={device} />
                  <DeviceMeta device={device} />
                  <span className="w-fit rounded-full border border-[#dfe6ee] bg-[#f8fafc] px-2.5 py-1 font-semibold">{rfidCards[device.terminalId]?.length ?? 0} badge(s)</span>
                  <ChevronDown size={16} className={"text-[#64748b] " + (isExpanded ? "rotate-180" : "")} />
                </button>

                {isExpanded ? (
                  <div className="mt-4 pl-0 md:pl-10">
                    <form onSubmit={(event) => { event.preventDefault(); addRfid(device); }} className="mb-3 grid gap-3 md:grid-cols-[1fr_220px_130px_90px]">
                      <input className="h-9 rounded-[6px] border border-[#dfe6ee] px-3" placeholder="Rechercher les badges charges" disabled />
                      <input value={rfidInputs[device.terminalId] ?? ""} onChange={(event) => setRfidInputs((current) => ({ ...current, [device.terminalId]: event.target.value }))} className="h-9 rounded-[6px] border border-[#dfe6ee] px-3" placeholder="Badge RFID a 10 chiffres" />
                      <label className={"flex h-9 items-center justify-center gap-2 rounded-[6px] border px-3 font-semibold " + (rfidAdminRoles[device.terminalId] ? "border-[#2A9D90] bg-[#ecfdf5] text-[#065f46]" : "border-[#dfe6ee] bg-white text-[#334155]")}>
                        <input type="checkbox" checked={Boolean(rfidAdminRoles[device.terminalId])} onChange={(event) => setRfidAdminRoles((current) => ({ ...current, [device.terminalId]: event.target.checked }))} />
                        Admin
                      </label>
                      <button type="submit" className="h-9 rounded-[6px] bg-[#111111] px-3 font-semibold text-white">Ajouter</button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {(rfidCards[device.terminalId] ?? []).map((card) => (
                        <span key={card.cardNumber} className={"flex items-center gap-2 rounded-[6px] border px-3 py-1.5 " + rfidCardClass(card)}>
                          <span>{card.cardNumber}</span>
                          {(card.isAdmin || card.role?.toLowerCase() === "admin") ? <span className="rounded-full bg-[#2A9D90] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span> : null}
                          <button type="button" onClick={() => deleteRfid(device, card.cardNumber)} className="rounded-full p-0.5 hover:bg-black/10" title="Supprimer le badge RFID"><X size={13} /></button>
                        </span>
                      ))}
                      {!(rfidCards[device.terminalId] ?? []).length ? <span className="rounded-[6px] border border-dashed border-[#cbd5e1] px-3 py-2 text-[#64748b]">Aucun badge RFID charge.</span> : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      <StatusMessage result={getResult("rfid-load", device.terminalId)} />
                      <StatusMessage result={getResult("rfid-add", device.terminalId)} />
                      <StatusMessage result={getResult("rfid-delete", device.terminalId)} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!pagedDevices.length ? <div className="rounded-[8px] border border-dashed border-[#cbd5e1] bg-white px-4 py-8 text-center text-[13px] text-[#64748b]">Aucun equipement ne correspond a cette vue.</div> : null}
        </div>

        <Pager page={currentPage} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredDevices.length} onPageChange={setPage} onRowsPerPageChange={setRowsPerPage} />
      </section>

      <FooterLegend devices={devices} />
    </div>
  );
}
