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
  Search,
  SignalHigh,
  Truck,
  X,
} from "lucide-react";
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
  name: "Device-A2-879",
  battery: index === 3 || index === 6 ? "03%" : index === 1 || index === 9 ? "53%" : "97%",
  signal: index === 2 || index === 6 ? "Poor" : index === 1 || index === 4 || index === 5 || index === 8 || index === 9 ? "Excellent" : "Average",
}));

const rfidTags = Array.from({ length: 18 }, () => "ID-798756");

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

function Pager() {
  return (
    <div className="flex items-center justify-between px-4 py-4 text-[12px] text-[#64748b]">
      <span>1 of 100 row(s) selected.</span>
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

function SearchField({ wide = false }: { wide?: boolean }) {
  return (
    <label className={`relative block ${wide ? "max-w-[430px]" : "max-w-[345px]"}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
      <input
        className="h-9 w-full rounded-[6px] border border-[#dfe6ee] bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8190a5] focus:border-[#2A9D90] focus:ring-2 focus:ring-[#2A9D90]/15"
        placeholder="Search Device"
      />
    </label>
  );
}

function StandardRows({ tab }: { tab: Tab }) {
  if (tab === "Device Status") {
    return (
      <div className="space-y-2">
        {devices.map((device) => (
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
      {devices.map((device, index) => (
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
            index === 1 ? (
              <input className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]" placeholder="Type Battery Level" />
            ) : (
              <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                Low battery <strong>10%</strong> <Edit3 size={14} className="text-[#64748b]" />
              </span>
            )
          ) : tab === "Sleep Mode" ? (
            index === 1 ? (
              <input className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]" placeholder="Enter Sleep Mode At (%)" />
            ) : (
              <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                Sleep Mode Trigger <strong>10%</strong> <Edit3 size={14} className="text-[#64748b]" />
              </span>
            )
          ) : tab === "Password" ? (
            index === 1 ? (
              <input className="h-8 w-full max-w-[240px] rounded-[6px] border border-[#dfe6ee] px-3 text-[12px]" defaultValue="12345678" />
            ) : (
              <span className="flex items-center justify-end gap-3 whitespace-nowrap">
                ************ <Eye size={14} className="text-[#64748b]" /> <Edit3 size={14} className="text-[#64748b]" />
              </span>
            )
          ) : null}
          </div>
          <div className="flex w-[64px] shrink-0 justify-end">
            <SaveButton dark={index === 1} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PhoneRows() {
  return (
    <div className="space-y-2">
      {devices.slice(0, 10).map((device) => (
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

function RfidRows() {
  return (
    <div className="space-y-2">
      {devices.slice(0, 8).map((device, index) => (
        <div key={device.id} className="rounded-[6px] bg-white px-3 py-3 text-[12px]">
          <div className="grid grid-cols-[28px_minmax(220px,1fr)_110px_130px_minmax(120px,1fr)_90px_24px] items-center gap-4">
            <input type="checkbox" aria-label={`Select ${device.name}`} />
            <span className="flex items-center gap-2 font-bold">
              <Truck size={13} className="text-[#64748b]" />
              {device.name}
            </span>
            <DeviceMeta battery={device.battery} signal="Poor" />
            <span />
            <span className="w-fit rounded-full border border-[#dfe6ee] bg-[#f8fafc] px-2.5 py-1 font-semibold">
              {index === 1 ? "18 Tag" : "129 Tag"}
            </span>
            <ChevronDown size={16} className={`text-[#64748b] ${index === 1 ? "rotate-180" : ""}`} />
          </div>
          {index === 1 ? (
            <div className="mt-4 pl-10">
              <div className="mb-3 grid gap-3 md:grid-cols-[1fr_240px_90px]">
                <input className="h-9 rounded-[6px] border border-[#dfe6ee] px-3" placeholder="Search Numbers" />
                <input className="h-9 rounded-[6px] border border-[#dfe6ee] px-3" placeholder="Type RFID Tag" />
                <button type="button" className="h-9 rounded-[6px] bg-[#111111] px-3 font-semibold text-white">
                  Add Tag
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {rfidTags.map((tag, tagIndex) => (
                  <span key={tagIndex} className="flex items-center gap-2 rounded-[6px] border border-[#dfe6ee] bg-white px-3 py-1.5">
                    {tag}
                    <X size={13} />
                  </span>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <SaveButton dark />
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TabContent({ tab }: { tab: Tab }) {
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
        ) : tab === "Sleep Mode" || tab === "Add RFID" ? (
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input type="checkbox" />
            Select All
          </label>
        ) : null}
      </div>

      <div className="mb-4">
        <SearchField wide={tab === "Add RFID"} />
      </div>

      {tab === "Phone Number" ? <PhoneRows /> : tab === "Add RFID" ? <RfidRows /> : <StandardRows tab={tab} />}
      <Pager />
    </section>
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
