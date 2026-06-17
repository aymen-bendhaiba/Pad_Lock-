"use client";

import {
  BatteryMedium,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Clock3,
  Command,
  Copy,
  RotateCcw,
  Trash2,
  Edit3,
  Eye,
  Plus,
  Search,
  Send,
  SignalHigh,
  SlidersHorizontal,
  Truck,
  Upload,
  X,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useState } from "react";

const tabs = [
  "Device Status",
  "Low Battery",
  "Sleep Mode",
  "Password",
  "Phone Number",
  "Add RFID",
] as const;

type Tab = (typeof tabs)[number];

const devices = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1,
  name: `Device-A2-${879 + index}`,
  code: `JT87-${230 + index}`,
  battery: index === 3 || index === 6 ? "03%" : index === 1 || index === 9 ? "53%" : "97%",
  signal: index === 2 || index === 6 ? "Poor" : index === 1 || index === 4 || index === 5 || index === 8 || index === 9 ? "Excellent" : "Average",
}));

const rfidTags = Array.from({ length: 18 }, () => "ID-798756");

type CommandMode = "Remote card authorization" | "RFID Cards Authorization";
type WorkspaceMode = CommandMode | "Commands";
type AuthorizationTab =
  | "On-site card authorization"
  | "Remote card authorization"
  | "Slave card authorization";

const commandHistorySeed = [
  {
    id: "CMD-8765",
    assetId: "DEV-0342",
    status: "Success",
    command: "Remote Lock",
    response: "Door locked successfully",
    time: "1.2s",
  },
  {
    id: "CMD-8764",
    assetId: "DEV-0341",
    status: "Pending",
    command: "GPS Location Request",
    response: "Location updated",
    time: "1.2s",
  },
  {
    id: "CMD-8763",
    assetId: "DEV-0340",
    status: "Failed",
    command: "Remote Unlock",
    response: "Device offline - timeout",
    time: "1.2s",
  },
  {
    id: "CMD-8762",
    assetId: "DEV-0339",
    status: "Success",
    command: "Alarm Configuration",
    response: "Alarm settings updated",
    time: "1.2s",
  },
  {
    id: "CMD-8761",
    assetId: "DEV-0338",
    status: "Success",
    command: "Reboot Device",
    response: "Waiting for acknowledgment",
    time: "1.2s",
  },
];

type CommandHistoryRow = (typeof commandHistorySeed)[number];

function batteryColor(value: string) {
  if (value === "03%") return "text-[#ef4444]";
  if (value === "53%") return "text-[#eab308]";
  return "text-[#059669]";
}

function signalColor(value: string) {
  if (value === "Poor") return "text-[#ef4444]";
  if (value === "Excellent") return "text-[#2A9D90]";
  return "text-[#94a3b8]";
}

function DeviceMeta({ battery, signal }: { battery: string; signal: string }) {
  return (
    <>
      <span className={`flex items-center gap-1.5 ${batteryColor(battery)}`}>
        <BatteryMedium size={13} />
        {battery}
      </span>
      <span className={`flex items-center gap-1.5 ${signalColor(signal)}`}>
        <SignalHigh size={13} />
        {signal}
      </span>
    </>
  );
}

function SaveButton({ dark = false }: { dark?: boolean }) {
  return (
    <button
      type="button"
      className={`h-7 rounded-[6px] px-3 text-[12px] font-semibold whitespace-nowrap text-white ${
        dark ? "bg-[#111111]" : "bg-[#9a9a9a]"
      }`}
    >
      Save
    </button>
  );
}

function Pager({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 text-[12px] text-[#64748b]">
      <span>{selectedCount} of 100 row(s) visible.</span>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-[#111827]">Rows per page</span>
        <button className="flex h-8 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3" type="button">
          10
          <ChevronDown size={12} />
        </button>
        <span className="font-semibold text-[#111827]">Page 1 of 10</span>
        <div className="flex gap-2">
          {[ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight].map((Icon, index) => (
            <button
              key={index}
              type="button"
              className="grid size-8 place-items-center rounded-[6px] bg-white text-[#94a3b8]"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterLegend() {
  return (
    <div className="flex flex-wrap justify-between gap-3 px-3 py-3 text-[11px] text-[#64748b]">
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {["All (253)", "Motion (172)", "Idle (56)", "Offline (32)", "Alarm (12)"].map((item, index) => (
          <span key={item} className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                index === 0
                  ? "bg-[#34C759]"
                  : index === 1
                    ? "bg-[#3b82f6]"
                    : index === 2
                      ? "bg-[#f97316]"
                      : index === 3
                        ? "bg-[#94a3b8]"
                        : "bg-[#ef4444]"
              }`}
            />
            {item}
          </span>
        ))}
      </div>
      <div className="flex gap-x-6">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#a16207]" />
          Locked: (322)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#a7f3d0]" />
          Unlocked: (72)
        </span>
      </div>
    </div>
  );
}

function SearchField({
  query,
  setQuery,
  wide = false,
}: {
  query: string;
  setQuery: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={`relative block ${wide ? "max-w-[430px]" : "max-w-[345px]"}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
        placeholder="Search Device"
      />
    </label>
  );
}

function EmptyRows() {
  return (
    <div className="grid h-32 place-items-center rounded-[6px] bg-white text-[13px] font-medium text-[#64748b]">
      No devices match your search.
    </div>
  );
}

function StandardRows({
  tab,
  rows,
}: {
  tab: Tab;
  rows: typeof devices;
}) {
  const [editingRowId, setEditingRowId] = useState<number | null>(
    tab === "Low Battery" || tab === "Sleep Mode" || tab === "Password"
      ? 2
      : null,
  );
  const [visiblePasswordId, setVisiblePasswordId] = useState<number | null>(null);

  if (rows.length === 0) return <EmptyRows />;

  if (tab === "Device Status") {
    return (
      <div className="space-y-2">
        {rows.map((device) => (
          <div
            key={device.id}
            className="flex h-11 items-center gap-4 rounded-[6px] bg-white px-3 text-[12px] font-medium"
          >
            <span className="flex min-w-[220px] flex-1 items-center gap-2 font-bold">
              <Truck size={13} className="text-[#64748b]" />
              {device.name}
            </span>
            <span className="flex w-[100px] shrink-0 items-center">
              <span className={`flex items-center gap-1.5 ${batteryColor(device.battery)}`}>
                <BatteryMedium size={13} />
                {device.battery}
              </span>
            </span>
            <span className="flex w-[130px] shrink-0 items-center">
              <span className={`flex items-center gap-1.5 ${signalColor(device.signal)}`}>
                <SignalHigh size={13} />
                {device.signal}
              </span>
            </span>
            <button
              type="button"
              className="h-7 w-[76px] shrink-0 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white"
            >
              Restart
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((device, index) => (
        <div
          key={device.id}
          className="flex h-11 items-center gap-4 rounded-[6px] bg-white px-3 text-[12px] font-medium"
        >
          <input
            className="shrink-0"
            type="checkbox"
            aria-label={`Select ${device.name}`}
          />
          <span className="flex min-w-[220px] flex-1 items-center gap-2 font-bold">
            <Truck size={13} className="text-[#64748b]" />
            {device.name}
          </span>
          <span className="flex w-[100px] shrink-0 items-center">
            <span className={`flex items-center gap-1.5 ${batteryColor(device.battery)}`}>
              <BatteryMedium size={13} />
              {device.battery}
            </span>
          </span>
          <span className="flex w-[130px] shrink-0 items-center">
            <span className={`flex items-center gap-1.5 ${signalColor(device.signal)}`}>
              <SignalHigh size={13} />
              {device.signal}
            </span>
          </span>
          <div className="flex min-w-[250px] flex-1 justify-end">
          {tab === "Low Battery" ? (
            editingRowId === device.id ? (
              <input
                autoFocus
                className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]"
                placeholder="Type Battery Level"
                defaultValue="10"
              />
            ) : (
              <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                Low battery <strong>10%</strong>
                <button
                  type="button"
                  onClick={() => setEditingRowId(device.id)}
                  aria-label={`Edit low battery value for ${device.name}`}
                  className="text-[#64748b] transition hover:text-[#2A9D90]"
                >
                  <Edit3 size={14} />
                </button>
              </span>
            )
          ) : tab === "Sleep Mode" ? (
            editingRowId === device.id ? (
              <input
                autoFocus
                className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]"
                placeholder="Enter Sleep Mode At (%)"
                defaultValue="10"
              />
            ) : (
              <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                Sleep Mode Trigger <strong>10%</strong>
                <button
                  type="button"
                  onClick={() => setEditingRowId(device.id)}
                  aria-label={`Edit sleep mode trigger for ${device.name}`}
                  className="text-[#64748b] transition hover:text-[#2A9D90]"
                >
                  <Edit3 size={14} />
                </button>
              </span>
            )
          ) : tab === "Password" ? (
            editingRowId === device.id ? (
              <input
                autoFocus
                className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]"
                defaultValue="12345678"
              />
            ) : (
              <span className="flex items-center justify-end gap-3 whitespace-nowrap">
                {visiblePasswordId === device.id ? "12345678" : "************"}
                <button
                  type="button"
                  onClick={() =>
                    setVisiblePasswordId(
                      visiblePasswordId === device.id ? null : device.id,
                    )
                  }
                  aria-label={`Toggle password visibility for ${device.name}`}
                  className="text-[#64748b] transition hover:text-[#2A9D90]"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRowId(device.id)}
                  aria-label={`Edit password for ${device.name}`}
                  className="text-[#64748b] transition hover:text-[#2A9D90]"
                >
                  <Edit3 size={14} />
                </button>
              </span>
            )
          ) : null}
          </div>
          <div className="flex w-[64px] shrink-0 justify-end">
            {tab === "Low Battery" || tab === "Sleep Mode" || tab === "Password" ? (
              <button
                type="button"
                onClick={() => setEditingRowId(null)}
                className={`h-7 rounded-[6px] px-3 text-[12px] font-semibold whitespace-nowrap text-white ${
                  editingRowId === device.id ? "bg-[#111111]" : "bg-[#9a9a9a]"
                }`}
              >
                Save
              </button>
            ) : (
              <SaveButton dark={index === 1} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhoneRows({ rows }: { rows: typeof devices }) {
  if (rows.length === 0) return <EmptyRows />;

  return (
    <div className="space-y-2">
      {rows.slice(0, 10).map((device) => (
        <div key={device.id} className="rounded-[6px] bg-white p-3 text-[12px]">
          <div className="mb-3 grid grid-cols-[minmax(220px,1fr)_110px_130px_70px] items-center gap-4 font-medium">
            <span className="flex items-center gap-2 font-bold">
              <Truck size={13} className="text-[#64748b]" />
              {device.name}
            </span>
            <DeviceMeta battery={device.battery} signal={device.signal} />
            <SaveButton dark />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, phoneIndex) => (
              <input
                key={phoneIndex}
                className="h-8 rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]"
                defaultValue="+212 6 87 00 00 00"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RfidRows({ rows }: { rows: typeof devices }) {
  const [expandedRowId, setExpandedRowId] = useState(2);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deviceTags, setDeviceTags] = useState(() =>
    Object.fromEntries(
      devices.map((device) => [
        device.id,
        rfidTags.map((value, index) => ({
          id: device.id * 1000 + index,
          value,
        })),
      ]),
    ) as Record<number, { id: number; value: string }[]>,
  );
  const [tagQuery, setTagQuery] = useState("");
  const [newTag, setNewTag] = useState("");

  if (rows.length === 0) return <EmptyRows />;

  const visibleRows = rows.slice(0, 8);
  const expandedTags = deviceTags[expandedRowId] ?? [];
  const filteredTags = expandedTags.filter((tag) =>
    tag.value.toLowerCase().includes(tagQuery.trim().toLowerCase()),
  );
  const allVisibleSelected = visibleRows.every((device) =>
    selectedIds.includes(device.id),
  );

  function toggleSelected(deviceId: number) {
    setSelectedIds((currentIds) =>
      currentIds.includes(deviceId)
        ? currentIds.filter((id) => id !== deviceId)
        : [...currentIds, deviceId],
    );
  }

  function toggleAllVisible() {
    setSelectedIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter(
          (id) => !visibleRows.some((device) => device.id === id),
        );
      }

      return Array.from(
        new Set([...currentIds, ...visibleRows.map((device) => device.id)]),
      );
    });
  }

  function addTag() {
    const trimmedTag = newTag.trim();

    if (!trimmedTag) return;

    setDeviceTags((currentTags) => ({
      ...currentTags,
      [expandedRowId]: [
        ...(currentTags[expandedRowId] ?? []),
        { id: Date.now(), value: trimmedTag },
      ],
    }));
    setNewTag("");
  }

  function removeTag(tagId: number) {
    setDeviceTags((currentTags) => ({
      ...currentTags,
      [expandedRowId]: (currentTags[expandedRowId] ?? []).filter(
        (tag) => tag.id !== tagId,
      ),
    }));
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-[12px] font-semibold">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
          />
          Select All
        </label>
      </div>
      {visibleRows.map((device) => {
        const isExpanded = expandedRowId === device.id;
        const tagCount = deviceTags[device.id]?.length ?? 0;

        return (
        <div key={device.id} className="rounded-[6px] bg-white px-3 py-3 text-[12px]">
          <div className="grid grid-cols-[28px_minmax(220px,1fr)_110px_130px_minmax(120px,1fr)_90px_24px] items-center gap-4">
            <input
              type="checkbox"
              checked={selectedIds.includes(device.id)}
              onChange={() => toggleSelected(device.id)}
              aria-label={`Select ${device.name}`}
            />
            <span className="flex items-center gap-2 font-bold">
              <Truck size={13} className="text-[#64748b]" />
              {device.name}
            </span>
            <DeviceMeta battery={device.battery} signal={device.signal} />
            <span />
            <span className="w-fit rounded-full border border-[#dfe6ee] bg-[#f8fafc] px-2.5 py-1 font-semibold">
              {tagCount} Tag
            </span>
            <button
              type="button"
              onClick={() => {
                setExpandedRowId(isExpanded ? 0 : device.id);
                setTagQuery("");
                setNewTag("");
              }}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} RFID tags for ${device.name}`}
              className="grid size-6 place-items-center rounded-[5px] text-[#64748b] transition hover:bg-[#eef4fa] hover:text-[#111827]"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {isExpanded ? (
            <div className="mt-4 pl-10">
              <div className="mb-3 grid gap-3 md:grid-cols-[1fr_240px_90px]">
                <input
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  className="h-9 rounded-[6px] border border-[#dfe6ee] px-3 outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                  placeholder="Search Numbers"
                />
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addTag();
                  }}
                  className="h-9 rounded-[6px] border border-[#dfe6ee] px-3 outline-none focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                  placeholder="Type RFID Tag"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="h-9 rounded-[6px] bg-[#111111] px-3 font-semibold text-white"
                >
                  Add Tag
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => (
                  <span key={tag.id} className="flex items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 py-1.5">
                    {tag.value}
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      aria-label={`Remove RFID tag ${tag.value}`}
                      className="text-[#111827] transition hover:text-[#ef4444]"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                {filteredTags.length === 0 ? (
                  <span className="text-[12px] font-medium text-[#64748b]">
                    No RFID tags match your search.
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex justify-end">
                <SaveButton dark />
              </div>
            </div>
          ) : null}
        </div>
        );
      })}
    </div>
  );
}

function TabContent({ tab }: { tab: Tab }) {
  const [query, setQuery] = useState("");
  const filteredDevices = devices.filter((device) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return true;

    return `${device.name} ${device.code}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const titles: Record<Tab, [string, string]> = {
    "Device Status": ["Restart Devices", "Select and restart devices to ensure optimal performance and system stability."],
    "Low Battery": ["Low Battery value settings", "View devices approaching critical battery levels and prioritize charging schedules."],
    "Sleep Mode": ["Device Sleep Mode", "Manage when devices enter and exit sleep mode to extend battery life and reduce energy usage."],
    Password: ["Password Management", "Update and manage device passwords to maintain secure access and system protection."],
    "Phone Number": ["Phone Number Management", "Configure and update device phone numbers for communication, connectivity, and remote operations."],
    "Add RFID": ["Add RFID Tag", "Register a new RFID identifier to link and track a device, user, or asset within the system."],
  };

  return (
    <section className="rounded-[8px] bg-[#eef4fa] p-4">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-[15px] font-bold">{titles[tab][0]}</h2>
          <p className="mt-1 text-[12px] text-[#64748b]">{titles[tab][1]}</p>
        </div>
        {tab === "Device Status" ? (
          <button className="h-8 w-fit rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white" type="button">
            Restart All
          </button>
        ) : tab === "Sleep Mode" ? (
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input type="checkbox" />
            Select All
          </label>
        ) : null}
      </div>

      <div className="mb-4">
        <SearchField
          query={query}
          setQuery={setQuery}
          wide={tab === "Add RFID"}
        />
      </div>

      {tab === "Phone Number" ? (
        <PhoneRows rows={filteredDevices} />
      ) : tab === "Add RFID" ? (
        <RfidRows rows={filteredDevices} />
      ) : (
        <StandardRows tab={tab} rows={filteredDevices} />
      )}
      <Pager selectedCount={filteredDevices.length} />
    </section>
  );
}

function statusBadgeClass(status: string) {
  if (status === "Success") return "bg-[#eaf8ef] text-[#16883f]";
  if (status === "Pending") return "bg-[#fff7d6] text-[#a16207]";
  return "bg-[#feecec] text-[#ef4444]";
}

function CommandMetric({
  icon,
  label,
  value,
  tone,
  delta,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
  delta?: string;
}) {
  return (
    <div className="flex min-h-[78px] items-center gap-4 rounded-[8px] border border-[#dfe6ee] bg-white px-5">
      <span className={`grid size-11 place-items-center rounded-[12px] ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#111827]">{label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <strong className="text-[25px] leading-none text-[#020617]">
            {value}
          </strong>
          {delta ? (
            <span className="pb-0.5 text-[11px] font-semibold text-[#22a45d]">
              {delta}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeviceSelector({
  selectedIds,
  setSelectedIds,
}: {
  selectedIds: number[];
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
}) {
  const [deviceQuery, setDeviceQuery] = useState("");
  const visibleDevices = devices
    .filter((device) =>
      `${device.name} ${device.code}`
        .toLowerCase()
        .includes(deviceQuery.trim().toLowerCase()),
    )
    .slice(0, 7);
  const allVisibleSelected =
    visibleDevices.length > 0 &&
    visibleDevices.every((device) => selectedIds.includes(device.id));

  function toggleDevice(deviceId: number) {
    setSelectedIds((currentIds) =>
      currentIds.includes(deviceId)
        ? currentIds.filter((id) => id !== deviceId)
        : [...currentIds, deviceId],
    );
  }

  function toggleAllDevices() {
    setSelectedIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter(
          (id) => !visibleDevices.some((device) => device.id === id),
        );
      }

      return Array.from(
        new Set([...currentIds, ...visibleDevices.map((device) => device.id)]),
      );
    });
  }

  return (
    <section className="mb-5 rounded-[8px] bg-[#eef4fa] p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-bold">Select device</h2>
          <span className="rounded-[5px] bg-white px-3 py-1 text-[12px] font-medium">
            Selected Devices <strong className="ml-2">{selectedIds.length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SearchField query={deviceQuery} setQuery={setDeviceQuery} wide />
          <button type="button" className="grid size-8 place-items-center rounded-[6px] bg-white text-[#64748b]">
            <ChevronLeft size={15} />
          </button>
          <span className="text-[12px] font-semibold text-[#496383]">7 / 45</span>
          <button type="button" className="grid size-8 place-items-center rounded-[6px] bg-white text-[#64748b]">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        <label className="flex h-[58px] shrink-0 items-center gap-2 text-[12px] font-semibold">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllDevices} />
          Select All
        </label>
        {visibleDevices.map((device) => {
          const selected = selectedIds.includes(device.id);

          return (
            <button
              key={device.id}
              type="button"
              onClick={() => toggleDevice(device.id)}
              className="flex h-[58px] min-w-[150px] flex-col justify-center rounded-[7px] border border-[#dfe6ee] bg-white px-3 text-left text-[12px] transition hover:border-[#2A9D90]"
            >
              <span className="mb-2 flex items-center gap-2 font-bold">
                <span
                  className={`grid size-4 place-items-center rounded-[3px] border ${
                    selected ? "border-[#111827] bg-[#111827] text-white" : "border-[#94a3b8] bg-white"
                  }`}
                >
                  {selected ? <Check size={12} /> : null}
                </span>
                <Truck size={13} className="text-[#64748b]" />
                {device.name}
              </span>
              <span className="flex items-center gap-2 pl-6">
                <DeviceMeta battery={device.battery} signal={device.signal} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommandsTerminalCenter() {
  const [selectedIds, setSelectedIds] = useState<number[]>([1, 2]);
  const [command, setCommand] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [historyRows, setHistoryRows] =
    useState<CommandHistoryRow[]>(commandHistorySeed);
  const [exported, setExported] = useState(false);
  const filteredHistory = historyRows.filter((row) => {
    const matchesText = `${row.id} ${row.assetId} ${row.status} ${row.command} ${row.response}`
      .toLowerCase()
      .includes(historyQuery.trim().toLowerCase());
    const matchesStatus = statusFilter === "All" || row.status === statusFilter;

    return matchesText && matchesStatus;
  });

  function executeCommand() {
    const trimmedCommand = command.trim();

    if (!trimmedCommand || selectedIds.length === 0) return;

    setHistoryRows((currentRows) => [
      {
        id: `CMD-${8766 + currentRows.length}`,
        assetId: `DEV-${String(342 + selectedIds[0]).padStart(4, "0")}`,
        status: "Pending",
        command: trimmedCommand,
        response: `${selectedIds.length} device(s) queued`,
        time: "0.0s",
      },
      ...currentRows,
    ]);
  }

  return (
    <div className="w-full px-4 py-7 md:px-6">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold tracking-normal text-black">Device Command Center</h1>
        <p className="mt-2 text-[13px] text-[#64748b]">
          Send remote commands - smart lock devices and manage fleet operations.
        </p>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CommandMetric icon={<Command size={21} className="text-[#2563eb]" />} label="Commands Sent Today" value="46" tone="bg-[#eff6ff]" />
        <CommandMetric icon={<Check size={22} className="text-[#16a34a]" />} label="Success Rate" value="98.3%" tone="bg-[#eaf8ef]" delta="+1.1%" />
        <CommandMetric icon={<Clock3 size={21} className="text-[#a16207]" />} label="Pending Commands" value="4" tone="bg-[#fff7d6]" />
        <CommandMetric icon={<CircleAlert size={21} className="text-[#ef4444]" />} label="Failed Commands Today" value="3" tone="bg-[#feecec]" />
      </div>

      <DeviceSelector selectedIds={selectedIds} setSelectedIds={setSelectedIds} />

      <section className="mb-5 rounded-[8px] bg-[#eef4fa] p-4">
        <h2 className="mb-3 text-[15px] font-bold">Custom Command Terminal</h2>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-[#64748b]">
          <span>Common commands:</span>
          {["AT+GPSINFO", "AT+UNLOCK", "AT+LOCK"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCommand(item)}
              className="rounded-[5px] bg-[#111111] px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex min-h-[92px] items-center gap-3 rounded-[7px] bg-[#050608] p-4">
          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="min-h-[60px] flex-1 resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-[#64748b]"
            placeholder="Type a command..."
          />
          <button
            type="button"
            onClick={executeCommand}
            className="flex h-10 items-center gap-2 rounded-[6px] bg-white px-4 text-[12px] font-bold text-[#111827]"
          >
            <Send size={15} />
            Execute
          </button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-[15px] font-bold">Command History</h2>
          <button
            type="button"
            onClick={() => setExported(true)}
            className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"
          >
            <Upload size={14} />
            {exported ? "Exported" : "Export"}
          </button>
        </div>
        <div className="mb-3 flex flex-col gap-3 md:flex-row">
          <SearchField query={historyQuery} setQuery={setHistoryQuery} wide />
          <label className="flex h-9 w-fit items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold">
            <SlidersHorizontal size={14} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent outline-none">
              {["All", "Success", "Pending", "Failed"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-hidden rounded-[7px] border border-[#dfe6ee] bg-white">
          <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr_2fr_70px] border-b border-[#dfe6ee] px-4 py-3 text-[12px] font-medium text-[#496383]">
            <span>Command Id</span>
            <span>Asset Id</span>
            <span>Status</span>
            <span>Command</span>
            <span>Timestamp</span>
            <span>Response</span>
            <span>Time</span>
          </div>
          {filteredHistory.map((row, index) => (
            <div key={`${row.id}-${index}`} className={`grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr_2fr_70px] px-4 py-3 text-[12px] ${index % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}`}>
              <span className="font-medium">{row.id}</span>
              <span>{row.assetId}</span>
              <span>
                <span className={`rounded-[5px] px-2 py-1 text-[11px] font-medium ${statusBadgeClass(row.status)}`}>{row.status}</span>
              </span>
              <span>{row.command}</span>
              <span>2023-06-23<br /><span className="text-[#64748b]">12:35:17</span></span>
              <span>{row.response}</span>
              <span>{row.time}</span>
            </div>
          ))}
          {filteredHistory.length === 0 ? (
            <div className="grid h-24 place-items-center text-[13px] font-medium text-[#64748b]">
              No command history matches your filters.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CommandCenter() {
  const [selectedIds, setSelectedIds] = useState<number[]>([1, 2]);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [authorizationTab, setAuthorizationTab] =
    useState<AuthorizationTab>("On-site card authorization");
  const [authorized, setAuthorized] = useState(false);
  const [synced, setSynced] = useState(false);
  const [rfidSearch, setRfidSearch] = useState("");
  const [rfidCards, setRfidCards] = useState(
    Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      value: "",
    })),
  );
  const [authorizationRows, setAuthorizationRows] = useState([
    {
      index: "01",
      cardNumber: "RFID-982761",
      deviceId: "Device-A2-879",
      dType: "Master",
      unbind: "Available",
      authorizedTime: "2026-06-17 09:42",
      authorizer: "Amina Alaoui",
    },
    {
      index: "02",
      cardNumber: "RFID-798756",
      deviceId: "Device-A2-880",
      dType: "Slave",
      unbind: "Available",
      authorizedTime: "2026-06-17 10:15",
      authorizer: "Amina Alaoui",
    },
  ]);

  const visibleDevices = devices
    .filter((device) =>
      `${device.name} ${device.code}`
        .toLowerCase()
        .includes(deviceQuery.trim().toLowerCase()),
    )
    .slice(0, 7);
  const allVisibleSelected =
    visibleDevices.length > 0 &&
    visibleDevices.every((device) => selectedIds.includes(device.id));
  const filteredAuthorizationRows = authorizationRows.filter((row) =>
    `${row.cardNumber} ${row.deviceId} ${row.dType} ${row.authorizer}`
      .toLowerCase()
      .includes(rfidSearch.trim().toLowerCase()),
  );

  function toggleDevice(deviceId: number) {
    setSelectedIds((currentIds) =>
      currentIds.includes(deviceId)
        ? currentIds.filter((id) => id !== deviceId)
        : [...currentIds, deviceId],
    );
  }

  function toggleAllDevices() {
    setSelectedIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter(
          (id) => !visibleDevices.some((device) => device.id === id),
        );
      }

      return Array.from(
        new Set([...currentIds, ...visibleDevices.map((device) => device.id)]),
      );
    });
  }

  function updateCard(cardId: number, value: string) {
    setRfidCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, value } : card,
      ),
    );
  }

  function addRfidCard() {
    setRfidCards((currentCards) => [
      ...currentCards,
      { id: Date.now(), value: "" },
    ]);
  }

  function clearRfidCards() {
    setRfidCards((currentCards) =>
      currentCards.map((card) => ({ ...card, value: "" })),
    );
  }

  function authorizeCards() {
    const enteredCards = rfidCards
      .map((card) => card.value.trim())
      .filter(Boolean);

    setAuthorized(true);

    if (enteredCards.length === 0) return;

    setAuthorizationRows((currentRows) => [
      ...enteredCards.map((cardNumber, index) => ({
        index: String(currentRows.length + index + 1).padStart(2, "0"),
        cardNumber,
        deviceId: devices[index % devices.length].name,
        dType: authorizationTab === "Slave card authorization" ? "Slave" : "Remote",
        unbind: "Available",
        authorizedTime: "2026-06-17 11:20",
        authorizer: "Amina Alaoui",
      })),
      ...currentRows,
    ]);
  }

  function unbindRows() {
    setAuthorizationRows((currentRows) =>
      currentRows.map((row) => ({ ...row, unbind: "Unbound" })),
    );
  }

  return (
    <div className="w-full px-4 py-7 md:px-6">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold tracking-normal text-black">
          Device Command Center
        </h1>
        <p className="mt-2 text-[13px] text-[#64748b]">
          Send remote commands - smart lock devices and manage fleet operations.
        </p>
      </div>

      <div className="mb-4 grid w-full max-w-[620px] grid-cols-3 rounded-[5px] bg-[#f1f1f2] p-0.5 text-[12px] font-medium text-[#64748b]">
        {[
          "On-site card authorization",
          "Remote card authorization",
          "Slave card authorization",
        ].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setAuthorizationTab(tab as AuthorizationTab)}
            className={`h-8 rounded-[4px] px-3 focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/15 ${
              authorizationTab === tab ? "bg-white text-[#111827] shadow-sm" : ""
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="mb-5 rounded-[8px] bg-[#eef4fa] p-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-bold">Select device</h2>
            <span className="rounded-[5px] bg-white px-3 py-1 text-[12px] font-medium">
              Selected Devices <strong className="ml-2">{selectedIds.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SearchField query={deviceQuery} setQuery={setDeviceQuery} wide />
            <button
              type="button"
              className="grid size-8 place-items-center rounded-[6px] bg-white text-[#64748b]"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[12px] font-semibold text-[#496383]">
              7 / 45
            </span>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-[6px] bg-white text-[#64748b]"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="mb-7 flex gap-3 overflow-x-auto pb-1">
          <label className="flex h-[58px] shrink-0 items-center gap-2 text-[12px] font-semibold">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllDevices}
            />
            Select All
          </label>
          {visibleDevices.map((device) => {
            const selected = selectedIds.includes(device.id);

            return (
              <button
                key={device.id}
                type="button"
                onClick={() => toggleDevice(device.id)}
                className="flex h-[58px] min-w-[150px] flex-col justify-center rounded-[7px] border border-[#dfe6ee] bg-white px-3 text-left text-[12px] transition hover:border-[#2A9D90]"
              >
                <span className="mb-2 flex items-center gap-2 font-bold">
                  <span
                    className={`grid size-4 place-items-center rounded-[3px] border ${
                      selected
                        ? "border-[#111827] bg-[#111827] text-white"
                        : "border-[#94a3b8] bg-white"
                    }`}
                  >
                    {selected ? <Check size={12} /> : null}
                  </span>
                  <Truck size={13} className="text-[#64748b]" />
                  {device.name}
                </span>
                <span className="flex items-center gap-2 pl-6">
                  <DeviceMeta battery={device.battery} signal={device.signal} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {authorizationTab === "On-site card authorization" ? (
        <section className="mb-5">
          <div className="mb-5 flex justify-end">
            <button
              type="button"
              onClick={() => setSynced(true)}
              className="flex h-9 items-center gap-2 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white"
            >
              <RotateCcw size={14} />
              {synced ? "Synchronized" : "Synchronize"}
            </button>
          </div>
          <div className="mb-5 grid gap-4 md:grid-cols-2">
            {["Start", "End"].map((action) => (
              <div
                key={action}
                className="flex min-h-[72px] items-center justify-between rounded-[7px] border border-[#dfe6ee] bg-white px-5"
              >
                <div className="flex items-center gap-3">
                  <Copy size={27} className="text-[#111827]" strokeWidth={1.5} />
                  <div>
                    <p className="text-[13px] font-medium">Door locked successfully</p>
                    <p className="text-[12px] text-[#64748b]">Excellent</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-9 rounded-[6px] bg-[#111111] px-4 text-[12px] font-semibold text-white"
                >
                  {action}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mb-5">
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={authorizeCards}
              className="flex h-9 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold"
            >
              <Copy size={14} />
              {authorized ? "Authorized" : "Authorize"}
            </button>
            <button
              type="button"
              onClick={() => setSynced(true)}
              className="flex h-9 items-center gap-2 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white"
            >
              <RotateCcw size={14} />
              {synced ? "Synchronized" : "Synchronize"}
            </button>
          </div>
          <h2 className="mb-3 text-[15px] font-bold">Slave lock list</h2>
          <div className="mb-7 grid h-[126px] place-items-center rounded-[7px] border border-[#dfe6ee] bg-white text-[18px] text-[#64748b]">
            No data
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">RFID List</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearRfidCards}
                className="grid size-9 place-items-center rounded-[6px] bg-[#dc2626] text-white"
                aria-label="Clear RFID card inputs"
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                onClick={addRfidCard}
                className="flex h-9 items-center gap-2 rounded-[6px] bg-[#111111] px-3 text-[12px] font-semibold text-white"
              >
                <Plus size={15} />
                Add RFID
              </button>
            </div>
          </div>
          <div className="grid gap-5 rounded-[7px] border border-[#dfe6ee] bg-white p-4 md:grid-cols-3">
            {rfidCards.map((card, index) => (
              <label key={card.id} className="text-[12px] font-medium">
                Card No. {index + 1}
                <input
                  value={card.value}
                  onChange={(event) => updateCard(card.id, event.target.value)}
                  className="mt-2 h-9 w-full rounded-[6px] border border-[#dfe6ee] px-3 outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
                  placeholder="Number"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Card Authorization</h2>
        </div>
        <div className="mb-3 flex flex-col gap-3 md:flex-row">
          <input
            value={rfidSearch}
            onChange={(event) => setRfidSearch(event.target.value)}
            className="h-9 w-full max-w-[345px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px] outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
            placeholder="Search RFID"
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => setSynced(true)} className="grid size-9 place-items-center rounded-[6px] bg-[#111111] text-white">
              <RotateCcw size={14} />
            </button>
            <button type="button" onClick={unbindRows} className="flex h-9 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold">
              <SlidersHorizontal size={14} />
              Batch unbind
            </button>
            <button type="button" onClick={unbindRows} className="flex h-9 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold">
              <Trash2 size={14} />
              Untie all
            </button>
            <button type="button" onClick={authorizeCards} className="flex h-9 items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 text-[12px] font-semibold">
              <Copy size={14} />
              Authorizer
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[7px] border border-[#dfe6ee] bg-white">
          <div className={`grid ${authorizationTab === "Slave card authorization" ? "grid-cols-[80px_1.2fr_1fr_1fr_1.5fr_1.2fr]" : "grid-cols-[80px_1.2fr_1fr_1fr_1.5fr_1.2fr]"} border-b border-[#dfe6ee] px-4 py-3 text-[12px] font-medium text-[#496383]`}>
            <span>Index</span>
            <span>Card number</span>
            <span>{authorizationTab === "Slave card authorization" ? "Sensor ID" : "Device ID"}</span>
            <span>{authorizationTab === "On-site card authorization" ? "D-Type" : "Unbind"}</span>
            <span>Authorized time</span>
            <span>Authorizer</span>
          </div>
          {filteredAuthorizationRows.map((row, index) => (
            <div
              key={`${row.cardNumber}-${index}`}
              className={`grid grid-cols-[80px_1.2fr_1fr_1fr_1.5fr_1.2fr] px-4 py-3 text-[12px] ${
                index % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"
              }`}
            >
              <span>{row.index}</span>
              <span>{row.cardNumber}</span>
              <span>{row.deviceId}</span>
              <span>{authorizationTab === "On-site card authorization" ? row.dType : row.unbind}</span>
              <span>{row.authorizedTime}</span>
              <span>{row.authorizer}</span>
            </div>
          ))}
          {filteredAuthorizationRows.length === 0 ? (
            <div className="grid h-[240px] place-items-center text-[16px] font-medium text-[#64748b]">
              No data
            </div>
          ) : null}
        </div>
        <Pager selectedCount={filteredAuthorizationRows.length} />
      </section>
      <FooterLegend />
    </div>
  );
}

export function CommandsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("Device Status");

  return (
    <div className="w-full px-4 py-7 md:px-6">
      <div className="mb-5">
        <h1 className="text-[26px] font-bold tracking-normal text-black">
          Device Status & Controls
        </h1>
        <p className="mt-2 text-[13px] text-[#64748b]">
          Manage and monitor all connected devices from a centralized control panel.
        </p>
      </div>

      <div className="mb-4 grid w-full max-w-[1040px] grid-cols-2 rounded-[5px] bg-[#f1f1f2] p-0.5 text-[12px] font-medium text-[#64748b] md:grid-cols-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`h-8 rounded-[4px] px-3 focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/15 ${
              activeTab === tab ? "bg-white text-[#111827] shadow-sm" : ""
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <TabContent tab={activeTab} />
      <FooterLegend />
    </div>
  );
}

export function CommandsWorkspace() {
  const [mode, setMode] = useState<WorkspaceMode>("Commands");

  return (
    <section className="min-w-0">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#dfe6ee] bg-white/95 px-4 backdrop-blur md:px-6">
        <label className="relative">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as WorkspaceMode)}
            className="h-9 min-w-[170px] appearance-none rounded-[5px] bg-[#050505] pl-3 pr-9 text-[12px] font-semibold text-white outline-none"
          >
            <option>Commands</option>
            <option>Remote card authorization</option>
            <option>RFID Cards Authorization</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white"
            size={14}
          />
        </label>

        <div className="flex items-center gap-4">
          <span className="hidden h-7 items-center rounded-full bg-[#eaf8ef] px-3 text-[12px] font-semibold text-[#16883f] sm:flex">
            <span className="mr-1.5 size-2 rounded-full bg-[#34C759]" />
            98 Online
          </span>
          <div className="hidden h-9 border-l border-[#dfe6ee] md:block" />
          <div className="hidden text-right md:block">
            <p className="text-[13px] font-semibold">Amina Alaoui</p>
            <p className="text-[12px] text-[#718096]">a.alaoui@harmony.ma</p>
          </div>
          <button type="button" className="flex items-center gap-2 rounded-full">
            <span className="grid size-10 place-items-center rounded-full bg-[#111827] text-[14px] font-bold text-white">
              AA
            </span>
            <ChevronDown className="hidden text-[#718096] sm:block" size={15} />
          </button>
        </div>
      </header>

      {mode === "Commands" ? (
        <CommandsTerminalCenter />
      ) : mode === "Remote card authorization" ? (
        <CommandCenter />
      ) : (
        <CommandsPanel />
      )}
    </section>
  );
}
