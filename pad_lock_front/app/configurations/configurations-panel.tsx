"use client";

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  RefreshCw,
  Phone,
  Router,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Waves,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, cachedApiJson, clearAppCache } from "../../lib/api";
import { userFriendlyError } from "../../lib/error-messages";

type ApiRecord = Record<string, unknown>;
type LoadState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";
type SimKey = "sim1" | "sim2";

type PhoneForm = {
  phoneNumber: string;
};

type DeviceOption = {
  terminalId: string;
  name: string;
  imei?: string;
};

type SimForm = {
  ipAddress: string;
  port: string;
  apn: string;
  apnUser: string;
  apnPassword: string;
  apnPasswordConfigured: boolean;
};

type ConfigurationForm = {
  sim1: SimForm;
  sim2: SimForm;
  trackingUploadIntervalSeconds: string;
  wakeUpIntervalMinutes: string;
  vibrationLevelMg: string;
  vipPhones: PhoneForm[];
};

type SyncInfo = {
  status?: "synced" | "pending" | "failed" | string | null;
  error?: string | null;
  syncedAt?: string | null;
} | null;

type ConfigResponse = {
  terminalId?: string;
  configured?: boolean;
  sim1?: Partial<SimForm> | null;
  sim2?: Partial<SimForm> | null;
  trackingUploadIntervalSeconds?: number | null;
  wakeUpIntervalMinutes?: number | null;
  vibrationLevelMg?: number | null;
  vipPhones?: unknown;
  vipPhoneNumbers?: unknown;
  phones?: unknown;
  phoneNumbers?: unknown;
  sync?: {
    sim1?: SyncInfo;
    sim2?: SyncInfo;
    reporting?: SyncInfo;
    vibration?: SyncInfo;
    phones?: SyncInfo;
    vipPhones?: SyncInfo;
  };
  updatedAt?: string;
};

function emptySim(): SimForm {
  return { ipAddress: "", port: "", apn: "", apnUser: "", apnPassword: "", apnPasswordConfigured: false };
}

function emptyPhones(): PhoneForm[] {
  return Array.from({ length: 5 }, () => ({ phoneNumber: "" }));
}

function defaultForm(): ConfigurationForm {
  return {
    sim1: emptySim(),
    sim2: emptySim(),
    trackingUploadIntervalSeconds: "30",
    wakeUpIntervalMinutes: "30",
    vibrationLevelMg: "126",
    vipPhones: emptyPhones(),
  };
}

function rowsFromPayload(payload: unknown): ApiRecord[] {
  if (Array.isArray(payload)) return payload.filter((row): row is ApiRecord => Boolean(row) && typeof row === "object");
  if (payload && typeof payload === "object") {
    const record = payload as ApiRecord;
    for (const key of ["data", "items", "results", "devices", "locks", "rows"]) {
      const value = record[key];
      if (Array.isArray(value)) return value.filter((row): row is ApiRecord => Boolean(row) && typeof row === "object");
    }
  }
  return [];
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : undefined;
}

function terminalIdFromRecord(record: ApiRecord) {
  return textValue(record.terminalId, record.terminalID, record.deviceId, record.lockId, record.id, record.serial, record.imei) ?? "unknown";
}

function normalizeDevice(record: ApiRecord, fallback?: ApiRecord): DeviceOption {
  const terminalId = terminalIdFromRecord(record);
  return {
    terminalId,
    name: textValue(record.name, record.assetName, record.deviceName, record.label, fallback?.name, fallback?.deviceName) ?? "PadLock-" + terminalId,
    imei: textValue(record.imei, fallback?.imei),
  };
}

function normalizePhoneItem(value: unknown): PhoneForm {
  if (typeof value === "string" || typeof value === "number") {
    return { phoneNumber: String(value) };
  }

  const record = asRecord(value);
  return {
    phoneNumber: textValue(record?.phoneNumber, record?.number, record?.value, record?.phone, record?.msisdn) ?? "",
  };
}

function phonesFromConfig(config: ConfigResponse | null): PhoneForm[] {
  const source = config?.vipPhones ?? config?.vipPhoneNumbers ?? config?.phones ?? config?.phoneNumbers;
  const phones = emptyPhones();

  if (Array.isArray(source)) {
    source.slice(0, 5).forEach((item, index) => {
      phones[index] = normalizePhoneItem(item);
    });
  } else if (source && typeof source === "object") {
    Object.values(source as Record<string, unknown>).slice(0, 5).forEach((item, index) => {
      phones[index] = normalizePhoneItem(item);
    });
  }

  return phones;
}

function simFromResponse(value: unknown): SimForm {
  const sim = asRecord(value);
  return {
    ipAddress: textValue(sim?.ipAddress) ?? "",
    port: textValue(sim?.port) ?? "",
    apn: textValue(sim?.apn) ?? "",
    apnUser: textValue(sim?.apnUser) ?? "",
    apnPassword: "",
    apnPasswordConfigured: sim?.apnPasswordConfigured === true,
  };
}

function formFromConfig(config: ConfigResponse | null): ConfigurationForm {
  return {
    sim1: simFromResponse(config?.sim1),
    sim2: simFromResponse(config?.sim2),
    trackingUploadIntervalSeconds: textValue(config?.trackingUploadIntervalSeconds) ?? "30",
    wakeUpIntervalMinutes: textValue(config?.wakeUpIntervalMinutes) ?? "30",
    vibrationLevelMg: textValue(config?.vibrationLevelMg) ?? "126",
    vipPhones: phonesFromConfig(config),
  };
}

function syncTone(sync: SyncInfo) {
  if (sync?.status === "synced") return "border-[#bbf7d0] bg-[#ecfdf5] text-[#047857]";
  if (sync?.status === "failed") return "border-red-100 bg-red-50 text-red-700";
  if (sync?.status === "pending") return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  return "border-[#dfe6ee] bg-white text-[#64748b]";
}

function syncLabel(status?: string | null) {
  if (status === "synced") return "Synchronise";
  if (status === "failed") return "Echec";
  if (status === "pending") return "En attente";
  return "Non synchronise";
}

function validateSim(sim: SimForm, label: string) {
  const hasMainValues = Boolean(sim.ipAddress.trim() || sim.port.trim() || sim.apn.trim() || sim.apnUser.trim() || sim.apnPassword.trim());
  if (!hasMainValues) return null;
  if (!sim.ipAddress.trim() || !sim.port.trim() || !sim.apn.trim()) return label + " doit contenir une adresse IP, un port et un APN.";
  const port = Number(sim.port);
  if (!Number.isInteger(port) || port < 1 || port > 65530) return "Le port " + label + " doit etre compris entre 1 et 65530.";
  if (/[(),\s]/.test(sim.ipAddress)) return "L'adresse IP ou le nom d'hote " + label + " ne doit pas contenir d'espaces, de virgules ou de parentheses.";
  if (/[(),]/.test(sim.apn) || /[(),]/.test(sim.apnUser) || /[(),]/.test(sim.apnPassword)) return "Les champs APN " + label + " ne doivent pas contenir de virgules ou de parentheses.";
  return null;
}

function simPayload(sim: SimForm) {
  const payload: Record<string, unknown> = {
    ipAddress: sim.ipAddress.trim(),
    port: Number(sim.port),
    apn: sim.apn.trim(),
    apnUser: sim.apnUser.trim(),
  };
  if (sim.apnPassword.trim() || !sim.apnPasswordConfigured) payload.apnPassword = sim.apnPassword;
  return payload;
}

function validateNumber(value: string, label: string, min: number, max: number, allowZero = false) {
  const number = Number(value);
  if (!Number.isInteger(number)) return label + " doit etre un nombre entier.";
  if (allowZero && number === 0) return null;
  if (number < min || number > max) return label + " doit etre compris entre " + min + " et " + max + ".";
  return null;
}

function SectionHeader({ icon: Icon, title, description, sync }: { icon: typeof Router; title: string; description: string; sync?: SyncInfo }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#e6edf5] bg-[#fbfdff] px-5 py-4 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#0f172a] text-white shadow-sm"><Icon size={18} /></span>
        <div>
          <h2 className="text-[15px] font-bold text-[#0f172a]">{title}</h2>
          <p className="mt-1 max-w-[620px] text-[12px] leading-snug text-[#64748b]">{description}</p>
        </div>
      </div>
      <span className={"inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize " + syncTone(sync ?? null)}>
        {sync?.status === "synced" ? <CheckCircle2 size={13} /> : sync?.status === "failed" ? <CircleAlert size={13} /> : sync?.status === "pending" ? <Clock3 size={13} /> : <ShieldCheck size={13} />}
        {syncLabel(sync?.status)}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", suffix }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; suffix?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-[#0f172a]"><span className="h-4 w-1 rounded-full bg-[#2A9D90]" />{label}</span>
      <span className="relative block">
        <input value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} title={value || placeholder} className="h-11 w-full min-w-0 rounded-[7px] border border-[#d8e2ec] bg-white px-3 pr-12 text-[13px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15" />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#64748b]">{suffix}</span> : null}
      </span>
    </label>
  );
}

function ActionButton({ children, onClick, loading, variant = "dark" }: { children: string; onClick: () => void; loading?: boolean; variant?: "dark" | "light" }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={("inline-flex h-9 items-center justify-center gap-2 rounded-[7px] px-3 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 " + (variant === "dark" ? "bg-[#111827] text-white hover:bg-black" : "border border-[#dfe6ee] bg-white text-[#334155] hover:bg-[#f8fafc]"))}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : variant === "dark" ? <Save size={14} /> : <RefreshCw size={14} />}
      {children}
    </button>
  );
}

function Message({ state, text }: { state: SaveState; text: string }) {
  if (!text) return null;
  const tone = state === "error" ? "bg-red-50 text-red-700" : state === "saved" ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#eef4fa] text-[#334155]";
  return <p className={"rounded-[7px] px-3 py-2 text-[12px] font-medium " + tone}>{text}</p>;
}

function SimCard({ simKey, title, form, sync, onChange, onRead, onSave, saving, reading }: {
  simKey: SimKey;
  title: string;
  form: SimForm;
  sync?: SyncInfo;
  onChange: (simKey: SimKey, next: SimForm) => void;
  onRead: () => void;
  onSave: () => void;
  saving?: boolean;
  reading?: boolean;
}) {
  function update(field: keyof SimForm, value: string) {
    onChange(simKey, { ...form, [field]: value });
  }

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white shadow-sm">
      <SectionHeader icon={Wifi} title={title} description="Parametres reseau utilises par le PadLock pour joindre la plateforme." sync={sync} />
      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[8px] border border-[#e6edf5] bg-[#fbfdff] p-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748b]">Connexion serveur</p>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_140px]">
            <Field label="Adresse IP ou domaine" value={form.ipAddress} onChange={(value) => update("ipAddress", value)} placeholder="jt701.jointcontrols.com" />
            <Field label="Port" value={form.port} onChange={(value) => update("port", value)} placeholder="10001" type="number" />
          </div>
          <div className="mt-3">
            <Field label="APN" value={form.apn} onChange={(value) => update("apn", value)} placeholder="internet" />
          </div>
        </div>

        <div className="rounded-[8px] border border-[#e6edf5] bg-[#fbfdff] p-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748b]">Identifiants APN</p>
          <div className="grid gap-3">
            <Field label="Utilisateur APN" value={form.apnUser} onChange={(value) => update("apnUser", value)} placeholder="Facultatif" />
            <Field label="Mot de passe APN" value={form.apnPassword} onChange={(value) => update("apnPassword", value)} placeholder={form.apnPasswordConfigured ? "Mot de passe deja enregistre" : "Facultatif"} />
          </div>
          <p className="mt-3 rounded-[7px] bg-white px-3 py-2 text-[11px] leading-snug text-[#64748b]">{form.apnPasswordConfigured ? "Mot de passe chiffre deja enregistre. Laissez vide pour le conserver." : "Aucun mot de passe APN enregistre pour ce canal."}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-white px-5 py-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] text-[#64748b]">Ecrivez seulement cette section apres modification. Les autres parametres ne sont pas envoyes.</p>
        <div className="flex gap-2"><ActionButton variant="light" onClick={onRead} loading={reading}>Lire</ActionButton><ActionButton onClick={onSave} loading={saving}>Ecrire</ActionButton></div>
      </div>
    </section>
  );
}

function PhoneCard({ phones, sync, onChange, onRead, onSave, saving, reading }: {
  phones: PhoneForm[];
  sync?: SyncInfo;
  onChange: (index: number, next: PhoneForm) => void;
  onRead: () => void;
  onSave: () => void;
  saving?: boolean;
  reading?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white shadow-sm">
      <SectionHeader icon={Phone} title="Numeros de telephone VIP" description="Renseignez les numeros autorises a recevoir les notifications d'alarme du PadLock." sync={sync} />
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
        {phones.map((phone, index) => (
          <div key={index} className="rounded-[8px] border border-[#e6edf5] bg-[#fbfdff] p-3">
            <Field label={"Telephone " + (index + 1)} value={phone.phoneNumber} onChange={(value) => onChange(index, { ...phone, phoneNumber: value })} placeholder="Ex: +212600000000" type="tel" />
            <p className="mt-3 rounded-[7px] bg-white px-3 py-2 text-[11px] font-semibold text-[#64748b]">Alarmes envoyees par defaut</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-white px-5 py-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] text-[#64748b]">Les champs vides sont ignores. Les alarmes sont envoyees par defaut aux numeros enregistres.</p>
        <div className="flex gap-2"><ActionButton variant="light" onClick={onRead} loading={reading}>Lire</ActionButton><ActionButton onClick={onSave} loading={saving}>Ecrire</ActionButton></div>
      </div>
    </section>
  );
}

export function ConfigurationsPanel() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [form, setForm] = useState<ConfigurationForm>(() => defaultForm());
  const [deviceState, setDeviceState] = useState<LoadState>("loading");
  const [configState, setConfigState] = useState<LoadState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [savedPhoneNumbers, setSavedPhoneNumbers] = useState<string[]>(() => Array.from({ length: 5 }, () => ""));
  const configReadInFlightRef = useRef<string | null>(null);
  const lastAutoReadTerminalRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDevices() {
      setDeviceState("loading");
      try {
        const [devicesPayload, locksPayload] = await Promise.all([
          cachedApiJson("/devices").catch(() => []),
          cachedApiJson("/locks").catch(() => []),
        ]);
        const lockRows = rowsFromPayload(locksPayload);
        const locksByTerminal = new Map(lockRows.map((row) => [terminalIdFromRecord(row), row]));
        const deviceRows = rowsFromPayload(devicesPayload);
        const sourceRows = deviceRows.length ? deviceRows : lockRows;
        const nextDevices = sourceRows
          .map((row) => normalizeDevice(row, locksByTerminal.get(terminalIdFromRecord(row))))
          .filter((device) => device.terminalId !== "unknown");
        if (!isMounted) return;
        setDevices(nextDevices);
        setSelectedTerminalId((current) => current || nextDevices[0]?.terminalId || "");
        setDeviceState("ready");
      } catch {
        if (!isMounted) return;
        setDeviceState("error");
        setMessage("Impossible de charger les PadLock depuis le serveur.");
      }
    }
    loadDevices();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedTerminalId) return;

    const timer = window.setTimeout(() => {
      void readConfiguration("read", selectedTerminalId, false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [selectedTerminalId]);

  const selectedDevice = devices.find((device) => device.terminalId === selectedTerminalId);
  const filteredDevices = useMemo(() => {
    const query = deviceQuery.trim().toLowerCase();
    return devices.filter((device) => query ? [device.name, device.terminalId, device.imei].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)) : true);
  }, [deviceQuery, devices]);

  async function readConfiguration(action = "read", terminalIdValue = selectedTerminalId, force = true) {
    if (!terminalIdValue) return;
    if (configReadInFlightRef.current === terminalIdValue) return;
    if (!force && lastAutoReadTerminalRef.current === terminalIdValue) return;

    configReadInFlightRef.current = terminalIdValue;
    setConfigState("loading");
    setActiveAction(action);
    setMessage(force ? "Lecture de la configuration depuis le PadLock..." : "Chargement de la configuration enregistree...");
    try {
      const configurationPath = "/locks/" + encodeURIComponent(terminalIdValue) + "/configuration";
      let usedSavedFallback = false;
      let response = await apiFetch(
        configurationPath + (force ? "/refresh" : ""),
        force ? { method: "POST", cache: "no-store" } : { cache: "no-store" },
      );
      let payload = await response.json().catch(() => null) as ConfigResponse | { message?: string } | null;

      if (force && response.status === 404) {
        usedSavedFallback = true;
        response = await apiFetch(configurationPath, { cache: "no-store" });
        payload = await response.json().catch(() => null) as ConfigResponse | { message?: string } | null;
      }

      if (!response.ok) throw new Error(userFriendlyError(payload, "Impossible de lire la configuration."));
      const nextConfig = payload as ConfigResponse;
      setConfig(nextConfig);
      setForm(formFromConfig(nextConfig));
      setConfigState("ready");
      setSaveState("idle");
      lastAutoReadTerminalRef.current = terminalIdValue;
      void readPhones(terminalIdValue);
      setMessage(
        nextConfig.configured
          ? usedSavedFallback
            ? "La lecture directe depuis le PadLock n'est pas disponible sur ce serveur. La configuration enregistree a ete chargee."
            : (force ? "Configuration lue depuis le PadLock." : "Configuration chargee depuis le serveur.")
          : "Aucune configuration enregistree pour ce PadLock. Remplissez les champs puis ecrivez la section voulue.",
      );
    } catch (error) {
      setConfigState("error");
      setSaveState("error");
      setMessage(userFriendlyError(error, "Impossible de lire la configuration."));
    } finally {
      if (configReadInFlightRef.current === terminalIdValue) configReadInFlightRef.current = null;
      setActiveAction(null);
    }
  }

  async function readPhones(terminalIdValue = selectedTerminalId, showLoading = false) {
    if (!terminalIdValue) return;

    if (showLoading) {
      setActiveAction("phones-read");
      setMessage("Chargement des numeros de telephone...");
    }

    try {
      const response = await apiFetch("/vip/phone?terminalId=" + encodeURIComponent(terminalIdValue), { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { phones?: unknown } | null;
      if (!response.ok) throw new Error(userFriendlyError(payload, "Impossible de charger les numeros de telephone."));

      const nextPhones = emptyPhones();
      const nextSaved = Array.from({ length: 5 }, () => "");
      const rows = Array.isArray(payload?.phones) ? payload.phones : [];

      rows.slice(0, 5).forEach((row, fallbackIndex) => {
        const record = asRecord(row);
        const indexValue = Number(record?.index);
        const index = Number.isInteger(indexValue) && indexValue >= 1 && indexValue <= 5 ? indexValue - 1 : fallbackIndex;
        const phoneNumber = textValue(record?.phoneNumber, record?.number, record?.value, record?.phone) ?? "";
        nextPhones[index] = { phoneNumber };
        nextSaved[index] = phoneNumber;
      });

      setSavedPhoneNumbers(nextSaved);
      setForm((current) => ({ ...current, vipPhones: nextPhones }));
    } catch (error) {
      setMessage(userFriendlyError(error, "Impossible de charger les numeros de telephone."));
    } finally {
      if (showLoading) setActiveAction(null);
    }
  }

  function updateSim(simKey: SimKey, next: SimForm) {
    setForm((current) => ({ ...current, [simKey]: next }));
  }

  function updatePhone(index: number, next: PhoneForm) {
    setForm((current) => {
      const vipPhones = [...current.vipPhones];
      vipPhones[index] = next;
      return { ...current, vipPhones };
    });
  }

  async function patchConfiguration(action: string, body: Record<string, unknown>) {
    if (!selectedTerminalId) return;
    setActiveAction(action);
    setSaveState("saving");
    setMessage("Enregistrement de la configuration...");
    try {
      const response = await apiFetch("/locks/" + encodeURIComponent(selectedTerminalId) + "/configuration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as ConfigResponse | { message?: string | string[]; error?: string } | null;
      if (!response.ok) {
        const rawMessage = payload && "message" in payload ? payload.message : undefined;
        throw new Error(userFriendlyError(rawMessage, "Le serveur a refuse la configuration."));
      }
      const nextConfig = payload as ConfigResponse;
      clearAppCache();
      setConfig(nextConfig);
      setForm(formFromConfig(nextConfig));
      setSaveState("saved");
      setMessage("Configuration enregistree. Les statuts ci-dessous indiquent ce que le PadLock a confirme.");
    } catch (error) {
      setSaveState("error");
      setMessage(userFriendlyError(error, "Impossible d'enregistrer la configuration."));
    } finally {
      setActiveAction(null);
    }
  }

  function saveSim(simKey: SimKey) {
    const label = simKey === "sim1" ? "SIM1" : "SIM2";
    const error = validateSim(form[simKey], label);
    if (error) {
      setSaveState("error");
      setMessage(error);
      return;
    }
    patchConfiguration(simKey, { [simKey]: simPayload(form[simKey]) });
  }

  function saveReporting() {
    const trackingError = validateNumber(form.trackingUploadIntervalSeconds, "L'intervalle d'envoi des positions", 5, 600);
    const wakeError = validateNumber(form.wakeUpIntervalMinutes, "L'intervalle de reveil", 5, 1440);
    if (trackingError || wakeError) {
      setSaveState("error");
      setMessage(trackingError ?? wakeError ?? "Valeurs de transmission invalides.");
      return;
    }
    patchConfiguration("reporting", {
      trackingUploadIntervalSeconds: Number(form.trackingUploadIntervalSeconds),
      wakeUpIntervalMinutes: Number(form.wakeUpIntervalMinutes),
    });
  }

  function saveVibration() {
    const vibrationError = validateNumber(form.vibrationLevelMg, "Le niveau de vibration", 63, 500, true);
    if (vibrationError) {
      setSaveState("error");
      setMessage(vibrationError);
      return;
    }
    patchConfiguration("vibration", { vibrationLevelMg: Number(form.vibrationLevelMg) });
  }

  async function savePhones() {
    if (!selectedTerminalId) return;

    setActiveAction("phones");
    setSaveState("saving");
    setMessage("Enregistrement des numeros de telephone...");

    try {
      const operations = form.vipPhones.map(async (phone, index) => {
        const phoneNumber = phone.phoneNumber.trim();
        const hadSavedNumber = Boolean(savedPhoneNumbers[index]?.trim());

        if (!phoneNumber && !hadSavedNumber) return;

        if (!phoneNumber) {
          const response = await apiFetch("/vip/phone?terminalId=" + encodeURIComponent(selectedTerminalId) + "&index=" + String(index + 1), { method: "DELETE" });
          const payload = await response.json().catch(() => null) as { message?: string | string[]; error?: string } | null;
          if (!response.ok) throw new Error(userFriendlyError(payload, "Impossible de supprimer un numero de telephone."));
          return;
        }

        const response = await apiFetch("/vip/phone/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terminalId: selectedTerminalId,
            index: index + 1,
            phoneNumber,
          }),
        });
        const payload = await response.json().catch(() => null) as { message?: string | string[]; error?: string } | null;
        if (!response.ok) throw new Error(userFriendlyError(payload, "Impossible d'enregistrer un numero de telephone."));
      });

      await Promise.all(operations);

      clearAppCache();
      setSaveState("saved");
      setMessage("Numeros de telephone enregistres.");
      void readPhones(selectedTerminalId);
    } catch (error) {
      setSaveState("error");
      setMessage(userFriendlyError(error, "Impossible d'enregistrer les numeros de telephone."));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 bg-[#f6f8fb] xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="border-r border-[#dfe6ee] bg-white px-4 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2A9D90]">Configuration PadLock</p>
          <h1 className="mt-1 text-[24px] font-bold text-black">Configurations</h1>
          <p className="mt-2 text-[12px] leading-snug text-[#64748b]">Selectionnez un PadLock, lisez sa configuration enregistree, puis ecrivez uniquement la section modifiee.</p>
        </div>

        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
          <input value={deviceQuery} onChange={(event) => setDeviceQuery(event.target.value)} className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15" placeholder="Rechercher un PadLock..." />
        </label>

        <div className="mt-4 max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto pr-1">
          {filteredDevices.map((device) => (
            <button key={device.terminalId} type="button" onClick={() => setSelectedTerminalId(device.terminalId)} className={("w-full rounded-[8px] border px-3 py-3 text-left transition " + (selectedTerminalId === device.terminalId ? "border-[#2A9D90] bg-[#ecfdf5]" : "border-[#e3e9f0] bg-white hover:border-[#b7c4d1]"))}>
              <span className="flex items-center gap-2 text-[13px] font-bold text-[#0f172a]"><Smartphone size={14} />{device.name}</span>
              <span className="mt-1 block text-[11px] text-[#64748b]">{device.terminalId}</span>
            </button>
          ))}
          {deviceState === "loading" ? <p className="rounded-[8px] bg-[#f8fafc] px-3 py-3 text-[12px] text-[#64748b]">Chargement des PadLock...</p> : null}
          {deviceState === "error" ? <p className="rounded-[8px] bg-red-50 px-3 py-3 text-[12px] text-red-700">Impossible de charger les PadLock.</p> : null}
          {deviceState === "ready" && filteredDevices.length === 0 ? <p className="rounded-[8px] border border-dashed border-[#cbd5e1] px-3 py-3 text-[12px] text-[#64748b]">Aucun PadLock ne correspond a votre recherche.</p> : null}
        </div>
      </aside>

      <section className="min-w-0 px-4 py-5 md:px-6">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-[22px] font-bold text-black">{selectedDevice?.name ?? "Selectionnez un PadLock"}</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">{selectedTerminalId ? "Terminal " + selectedTerminalId : "Choisissez un PadLock pour gerer sa configuration SIM, transmission et vibration."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="light" onClick={() => readConfiguration("read", selectedTerminalId, true)} loading={activeAction === "read" || configState === "loading"}>Lire la configuration</ActionButton>
          </div>
        </div>

        <Message state={saveState} text={message} />

        <div className="mt-4 grid gap-4">
          <div className="rounded-[8px] border border-[#dfe6ee] bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[13px] font-bold text-[#0f172a]">Etat de la configuration</p>
                <p className="mt-1 text-[12px] text-[#64748b]">{config?.configured ? "Une configuration est deja enregistree." : "Aucune configuration enregistree pour ce PadLock."}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.reporting ?? null)}>Transmission : {syncLabel(config?.sync?.reporting?.status)}</span>
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.vibration ?? null)}>Vibration : {syncLabel(config?.sync?.vibration?.status)}</span>
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.sim1 ?? null)}>SIM1 : {syncLabel(config?.sync?.sim1?.status)}</span>
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.sim2 ?? null)}>SIM2 : {syncLabel(config?.sync?.sim2?.status)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <SimCard simKey="sim1" title="Canal donnees SIM1" form={form.sim1} sync={config?.sync?.sim1} onChange={updateSim} onRead={() => readConfiguration("sim1-read", selectedTerminalId, true)} onSave={() => saveSim("sim1")} reading={activeAction === "sim1-read"} saving={activeAction === "sim1"} />
            <SimCard simKey="sim2" title="Canal secours SIM2" form={form.sim2} sync={config?.sync?.sim2} onChange={updateSim} onRead={() => readConfiguration("sim2-read", selectedTerminalId, true)} onSave={() => saveSim("sim2")} reading={activeAction === "sim2-read"} saving={activeAction === "sim2"} />
            <PhoneCard phones={form.vipPhones} sync={config?.sync?.phones ?? config?.sync?.vipPhones} onChange={updatePhone} onRead={() => readPhones(selectedTerminalId, true)} onSave={savePhones} reading={activeAction === "phones-read"} saving={activeAction === "phones"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white shadow-sm">
              <SectionHeader icon={Router} title="Rythme de transmission" description="" sync={config?.sync?.reporting} />
              <div className="grid gap-3 p-4">
                <Field label="Intervalle d'envoi des positions" value={form.trackingUploadIntervalSeconds} onChange={(value) => setForm((current) => ({ ...current, trackingUploadIntervalSeconds: value }))} type="number" suffix="sec" />
                <Field label="Intervalle de reveil" value={form.wakeUpIntervalMinutes} onChange={(value) => setForm((current) => ({ ...current, wakeUpIntervalMinutes: value }))} type="number" suffix="min" />
              </div>
              <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-[#fbfdff] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[11px] text-[#64748b]">Plages autorisees : envoi 5-600 secondes, reveil 5-1440 minutes.</p>
                <div className="flex gap-2"><ActionButton variant="light" onClick={() => readConfiguration("reporting-read", selectedTerminalId, true)} loading={activeAction === "reporting-read"}>Lire</ActionButton><ActionButton onClick={saveReporting} loading={activeAction === "reporting"}>Ecrire</ActionButton></div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white shadow-sm">
              <SectionHeader icon={Waves} title="Sensibilite aux vibrations" description="" sync={config?.sync?.vibration} />
              <div className="p-4">
                <Field label="Niveau de vibration" value={form.vibrationLevelMg} onChange={(value) => setForm((current) => ({ ...current, vibrationLevelMg: value }))} type="number" suffix="mg" />
                <div className="mt-4 rounded-[8px] bg-[#f8fafc] px-3 py-3 text-[12px] text-[#64748b]">
                  <p className="font-semibold text-[#0f172a]">Valeurs conseillees</p>
                  <p className="mt-1">126 mg est la valeur par defaut. Une valeur non nulle plus basse rend la detection plus sensible.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-[#fbfdff] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[11px] text-[#64748b]">Autorise : 0, ou 63-500 mg.</p>
                <div className="flex gap-2"><ActionButton variant="light" onClick={() => readConfiguration("vibration-read", selectedTerminalId, true)} loading={activeAction === "vibration-read"}>Lire</ActionButton><ActionButton onClick={saveVibration} loading={activeAction === "vibration"}>Ecrire</ActionButton></div>
              </div>
            </section>
          </div>

          <section className="rounded-[8px] border border-[#dfe6ee] bg-white px-5 py-4 shadow-sm">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#ecfdf5] text-[#047857]"><ShieldCheck size={18} /></span>
              <div>
                <h3 className="text-[14px] font-bold text-[#0f172a]">Synchronisation avec le PadLock</h3>
                <p className="mt-1 text-[12px] leading-snug text-[#64748b]">Une ecriture reussie enregistre les valeurs demandees meme si le PadLock est hors ligne. Les sections en attente ou en echec peuvent etre renvoyees, et le serveur reessaie aussi lorsque le PadLock se reconnecte.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

