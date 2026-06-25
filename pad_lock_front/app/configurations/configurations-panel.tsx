"use client";

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  RefreshCw,
  Router,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Waves,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, cachedApiJson, clearAppCache } from "../../lib/api";

type ApiRecord = Record<string, unknown>;
type LoadState = "idle" | "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";
type SimKey = "sim1" | "sim2";

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
  sync?: {
    sim1?: SyncInfo;
    sim2?: SyncInfo;
    reporting?: SyncInfo;
    vibration?: SyncInfo;
  };
  updatedAt?: string;
};

function emptySim(): SimForm {
  return { ipAddress: "", port: "", apn: "", apnUser: "", apnPassword: "", apnPasswordConfigured: false };
}

function defaultForm(): ConfigurationForm {
  return {
    sim1: emptySim(),
    sim2: emptySim(),
    trackingUploadIntervalSeconds: "30",
    wakeUpIntervalMinutes: "30",
    vibrationLevelMg: "126",
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
    name: textValue(record.name, record.assetName, record.deviceName, record.label, fallback?.name, fallback?.deviceName) ?? "Device-" + terminalId,
    imei: textValue(record.imei, fallback?.imei),
  };
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
  };
}

function syncTone(sync: SyncInfo) {
  if (sync?.status === "synced") return "border-[#bbf7d0] bg-[#ecfdf5] text-[#047857]";
  if (sync?.status === "failed") return "border-red-100 bg-red-50 text-red-700";
  if (sync?.status === "pending") return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  return "border-[#dfe6ee] bg-white text-[#64748b]";
}

function syncIcon(sync: SyncInfo) {
  if (sync?.status === "synced") return CheckCircle2;
  if (sync?.status === "failed") return CircleAlert;
  if (sync?.status === "pending") return Clock3;
  return ShieldCheck;
}

function validateSim(sim: SimForm, label: string) {
  const hasMainValues = Boolean(sim.ipAddress.trim() || sim.port.trim() || sim.apn.trim() || sim.apnUser.trim() || sim.apnPassword.trim());
  if (!hasMainValues) return null;
  if (!sim.ipAddress.trim() || !sim.port.trim() || !sim.apn.trim()) return label + " needs IP address, port, and APN.";
  const port = Number(sim.port);
  if (!Number.isInteger(port) || port < 1 || port > 65530) return label + " port must be between 1 and 65530.";
  if (/[(),\s]/.test(sim.ipAddress)) return label + " IP/host cannot contain spaces, commas, or parentheses.";
  if (/[(),]/.test(sim.apn) || /[(),]/.test(sim.apnUser) || /[(),]/.test(sim.apnPassword)) return label + " APN fields cannot contain commas or parentheses.";
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
  if (!Number.isInteger(number)) return label + " must be a whole number.";
  if (allowZero && number === 0) return null;
  if (number < min || number > max) return label + " must be between " + min + " and " + max + ".";
  return null;
}

function SectionHeader({ icon: Icon, title, description, sync }: { icon: typeof Router; title: string; description: string; sync?: SyncInfo }) {
  const SyncIcon = syncIcon(sync ?? null);
  return (
    <div className="flex flex-col gap-3 border-b border-[#e6edf5] px-4 py-4 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#0f172a] text-white"><Icon size={18} /></span>
        <div>
          <h2 className="text-[15px] font-bold text-[#0f172a]">{title}</h2>
          <p className="mt-1 text-[12px] leading-snug text-[#64748b]">{description}</p>
        </div>
      </div>
      <span className={"inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize " + syncTone(sync ?? null)}>
        <SyncIcon size={13} />
        {sync?.status ?? "not synced"}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", suffix }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-[#0f172a]"><span className="h-4 w-1 rounded-full bg-[#34C759]" />{label}</span>
      <span className="relative block">
        <input value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white px-3 pr-12 text-[12px] outline-none transition placeholder:text-[#9aa8b8] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15" />
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
    <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white">
      <SectionHeader icon={Wifi} title={title} description="Network destination and APN profile sent with the JT701D P06 command." sync={sync} />
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <Field label="IP Address" value={form.ipAddress} onChange={(value) => update("ipAddress", value)} placeholder="jt701.jointcontrols.com" />
        <Field label="Port" value={form.port} onChange={(value) => update("port", value)} placeholder="10001" type="number" />
        <Field label="APN" value={form.apn} onChange={(value) => update("apn", value)} placeholder="internet" />
        <Field label="APN User" value={form.apnUser} onChange={(value) => update("apnUser", value)} placeholder="Optional" />
        <Field label="APN Pass" value={form.apnPassword} onChange={(value) => update("apnPassword", value)} placeholder={form.apnPasswordConfigured ? "Saved, leave blank" : "Optional"} />
      </div>
      <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-[#fbfdff] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] text-[#64748b]">{form.apnPasswordConfigured ? "Encrypted password is saved. Leave APN Pass empty to preserve it." : "No saved APN password yet."}</p>
        <div className="flex gap-2"><ActionButton variant="light" onClick={onRead} loading={reading}>Read</ActionButton><ActionButton onClick={onSave} loading={saving}>Write</ActionButton></div>
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

  useEffect(() => {
    let isMounted = true;
    async function loadDevices() {
      setDeviceState("loading");
      try {
        const [devicesPayload, locksPayload] = await Promise.all([
          cachedApiJson("/devices", true).catch(() => []),
          cachedApiJson("/locks", true).catch(() => []),
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
        setMessage("Could not load backend devices.");
      }
    }
    loadDevices();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedTerminalId) return;
    void readConfiguration();
  }, [selectedTerminalId]);

  const selectedDevice = devices.find((device) => device.terminalId === selectedTerminalId);
  const filteredDevices = useMemo(() => {
    const query = deviceQuery.trim().toLowerCase();
    return devices.filter((device) => query ? [device.name, device.terminalId, device.imei].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)) : true);
  }, [deviceQuery, devices]);

  async function readConfiguration(action = "read") {
    if (!selectedTerminalId) return;
    setConfigState("loading");
    setActiveAction(action);
    setMessage("Loading saved configuration...");
    try {
      const response = await apiFetch("/locks/" + encodeURIComponent(selectedTerminalId) + "/configuration", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as ConfigResponse | { message?: string } | null;
      if (!response.ok) throw new Error(payload && "message" in payload && payload.message ? payload.message : "Could not read configuration.");
      const nextConfig = payload as ConfigResponse;
      setConfig(nextConfig);
      setForm(formFromConfig(nextConfig));
      setConfigState("ready");
      setSaveState("idle");
      setMessage(nextConfig.configured ? "Configuration loaded from backend." : "No saved configuration yet. Fill the fields and write a section.");
    } catch (error) {
      setConfigState("error");
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not read configuration.");
    } finally {
      setActiveAction(null);
    }
  }

  function updateSim(simKey: SimKey, next: SimForm) {
    setForm((current) => ({ ...current, [simKey]: next }));
  }

  async function patchConfiguration(action: string, body: Record<string, unknown>) {
    if (!selectedTerminalId) return;
    setActiveAction(action);
    setSaveState("saving");
    setMessage("Writing configuration to backend...");
    try {
      const response = await apiFetch("/locks/" + encodeURIComponent(selectedTerminalId) + "/configuration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as ConfigResponse | { message?: string | string[]; error?: string } | null;
      if (!response.ok) {
        const rawMessage = payload && "message" in payload ? payload.message : undefined;
        throw new Error(Array.isArray(rawMessage) ? rawMessage.join(" ") : rawMessage || "Backend did not accept the configuration.");
      }
      const nextConfig = payload as ConfigResponse;
      clearAppCache();
      setConfig(nextConfig);
      setForm(formFromConfig(nextConfig));
      setSaveState("saved");
      setMessage("Configuration saved. Sync status below shows what the lock acknowledged.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save configuration.");
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
    const trackingError = validateNumber(form.trackingUploadIntervalSeconds, "Tracking upload interval", 5, 600);
    const wakeError = validateNumber(form.wakeUpIntervalMinutes, "Wake up interval", 5, 1440);
    if (trackingError || wakeError) {
      setSaveState("error");
      setMessage(trackingError ?? wakeError ?? "Invalid reporting values.");
      return;
    }
    patchConfiguration("reporting", {
      trackingUploadIntervalSeconds: Number(form.trackingUploadIntervalSeconds),
      wakeUpIntervalMinutes: Number(form.wakeUpIntervalMinutes),
    });
  }

  function saveVibration() {
    const vibrationError = validateNumber(form.vibrationLevelMg, "Vibration level", 63, 500, true);
    if (vibrationError) {
      setSaveState("error");
      setMessage(vibrationError);
      return;
    }
    patchConfiguration("vibration", { vibrationLevelMg: Number(form.vibrationLevelMg) });
  }

  return (
    <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="border-r border-[#dfe6ee] bg-white px-4 py-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2A9D90]">Lock setup</p>
          <h1 className="mt-1 text-[24px] font-bold text-black">Configurations</h1>
          <p className="mt-2 text-[12px] leading-snug text-[#64748b]">Choose a real lock, read its saved backend configuration, then write only the section you changed.</p>
        </div>

        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
          <input value={deviceQuery} onChange={(event) => setDeviceQuery(event.target.value)} className="h-10 w-full rounded-[7px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15" placeholder="Search locks..." />
        </label>

        <div className="mt-4 max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto pr-1">
          {filteredDevices.map((device) => (
            <button key={device.terminalId} type="button" onClick={() => setSelectedTerminalId(device.terminalId)} className={("w-full rounded-[8px] border px-3 py-3 text-left transition " + (selectedTerminalId === device.terminalId ? "border-[#2A9D90] bg-[#ecfdf5]" : "border-[#e3e9f0] bg-white hover:border-[#b7c4d1]"))}>
              <span className="flex items-center gap-2 text-[13px] font-bold text-[#0f172a]"><Smartphone size={14} />{device.name}</span>
              <span className="mt-1 block text-[11px] text-[#64748b]">{device.terminalId}</span>
            </button>
          ))}
          {deviceState === "loading" ? <p className="rounded-[8px] bg-[#f8fafc] px-3 py-3 text-[12px] text-[#64748b]">Loading backend locks...</p> : null}
          {deviceState === "error" ? <p className="rounded-[8px] bg-red-50 px-3 py-3 text-[12px] text-red-700">Could not load locks.</p> : null}
          {deviceState === "ready" && filteredDevices.length === 0 ? <p className="rounded-[8px] border border-dashed border-[#cbd5e1] px-3 py-3 text-[12px] text-[#64748b]">No lock matches your search.</p> : null}
        </div>
      </aside>

      <section className="min-w-0 px-4 py-5 md:px-6">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-[22px] font-bold text-black">{selectedDevice?.name ?? "Select a lock"}</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">{selectedTerminalId ? "Terminal " + selectedTerminalId : "Pick a lock to manage its SIM, reporting, and vibration configuration."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="light" onClick={() => readConfiguration()} loading={activeAction === "read" || configState === "loading"}>Read current</ActionButton>
          </div>
        </div>

        <Message state={saveState} text={message} />

        <div className="mt-4 grid gap-4">
          <div className="rounded-[8px] border border-[#dfe6ee] bg-white px-4 py-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[13px] font-bold text-[#0f172a]">Configuration health</p>
                <p className="mt-1 text-[12px] text-[#64748b]">{config?.configured ? "Saved configuration exists." : "No saved configuration yet for this lock."}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.reporting ?? null)}>Reporting: {config?.sync?.reporting?.status ?? "none"}</span>
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.vibration ?? null)}>Vibration: {config?.sync?.vibration?.status ?? "none"}</span>
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.sim1 ?? null)}>SIM1: {config?.sync?.sim1?.status ?? "none"}</span>
                <span className={"rounded-full border px-2.5 py-1 capitalize " + syncTone(config?.sync?.sim2 ?? null)}>SIM2: {config?.sync?.sim2?.status ?? "none"}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 2xl:grid-cols-2">
            <SimCard simKey="sim1" title="SIM1 data channel" form={form.sim1} sync={config?.sync?.sim1} onChange={updateSim} onRead={() => readConfiguration("sim1-read")} onSave={() => saveSim("sim1")} reading={activeAction === "sim1-read"} saving={activeAction === "sim1"} />
            <SimCard simKey="sim2" title="SIM2 backup channel" form={form.sim2} sync={config?.sync?.sim2} onChange={updateSim} onRead={() => readConfiguration("sim2-read")} onSave={() => saveSim("sim2")} reading={activeAction === "sim2-read"} saving={activeAction === "sim2"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white">
              <SectionHeader icon={Router} title="Reporting rhythm" description="Tracking upload interval and wake-up interval are sent together with the JT701D P04 command." sync={config?.sync?.reporting} />
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <Field label="Tracking Uploading Interval" value={form.trackingUploadIntervalSeconds} onChange={(value) => setForm((current) => ({ ...current, trackingUploadIntervalSeconds: value }))} type="number" suffix="sec" />
                <Field label="Wake up Interval" value={form.wakeUpIntervalMinutes} onChange={(value) => setForm((current) => ({ ...current, wakeUpIntervalMinutes: value }))} type="number" suffix="min" />
              </div>
              <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-[#fbfdff] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[11px] text-[#64748b]">Allowed ranges: upload 5-600 seconds, wake up 5-1440 minutes.</p>
                <div className="flex gap-2"><ActionButton variant="light" onClick={() => readConfiguration("reporting-read")} loading={activeAction === "reporting-read"}>Read</ActionButton><ActionButton onClick={saveReporting} loading={activeAction === "reporting"}>Write</ActionButton></div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white">
              <SectionHeader icon={Waves} title="Vibration sensitivity" description="Motion detection threshold sent with P37. Use 0 to disable motion detection." sync={config?.sync?.vibration} />
              <div className="p-4">
                <Field label="Vibration Level" value={form.vibrationLevelMg} onChange={(value) => setForm((current) => ({ ...current, vibrationLevelMg: value }))} type="number" suffix="mg" />
                <div className="mt-4 rounded-[8px] bg-[#f8fafc] px-3 py-3 text-[12px] text-[#64748b]">
                  <p className="font-semibold text-[#0f172a]">Suggested defaults</p>
                  <p className="mt-1">126 mg is the backend default. Lower non-zero values are more sensitive.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#e6edf5] bg-[#fbfdff] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[11px] text-[#64748b]">Allowed: 0, or 63-500 mg.</p>
                <div className="flex gap-2"><ActionButton variant="light" onClick={() => readConfiguration("vibration-read")} loading={activeAction === "vibration-read"}>Read</ActionButton><ActionButton onClick={saveVibration} loading={activeAction === "vibration"}>Write</ActionButton></div>
              </div>
            </section>
          </div>

          <section className="rounded-[8px] border border-[#dfe6ee] bg-white px-4 py-4">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#ecfdf5] text-[#047857]"><ShieldCheck size={18} /></span>
              <div>
                <h3 className="text-[14px] font-bold text-[#0f172a]">Backend sync behavior</h3>
                <p className="mt-1 text-[12px] leading-snug text-[#64748b]">A successful write saves desired values even when the physical lock is offline. Pending or failed sections can be retried by writing again, and the backend also retries when the lock reconnects.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
