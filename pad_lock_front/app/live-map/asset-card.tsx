"use client";

import { BatteryFull, BatteryLow, BatteryMedium, Lock, MapPinOff, Unlock } from "lucide-react";
import type { LiveMapAsset } from "./live-map-data";

type AssetCardProps = {
  asset: LiveMapAsset;
  isSelected?: boolean;
  onSelect?: (asset: LiveMapAsset) => void;
};

export function AssetCard({ asset, isSelected = false, onSelect }: AssetCardProps) {
  function focusAsset() {
    if (!asset.position) {
      return;
    }

    onSelect?.(asset);

    window.dispatchEvent(
      new CustomEvent("fleet:focus-asset", {
        detail: { position: asset.position, terminalId: asset.terminalId },
      }),
    );
  }

  const isAlarm = asset.status === "Alarm";
  const isDisabled = !asset.position;
  const batteryValue = Number.parseInt(asset.battery, 10);
  const BatteryIcon = Number.isFinite(batteryValue)
    ? batteryValue <= 20
      ? BatteryLow
      : batteryValue >= 70
        ? BatteryFull
        : BatteryMedium
    : BatteryMedium;
  const batteryColor = Number.isFinite(batteryValue)
    ? batteryValue <= 20
      ? "text-[#ef4444]"
      : batteryValue <= 50
        ? "text-[#f59e0b]"
        : "text-[#059669]"
    : "text-[#94a3b8]";

  return (
    <button
      type="button"
      onClick={focusAsset}
      disabled={isDisabled}
      className={`block w-full rounded-[9px] p-4 text-left transition hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/20 disabled:cursor-not-allowed disabled:opacity-70 ${
        isSelected ? "bg-[#ecfdf5] ring-1 ring-[#2A9D90]/35" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-[8px] text-white"
            style={{ backgroundColor: asset.color }}
          >
            {asset.position ? (
              asset.lock === "Unlocked" ? <Unlock size={18} /> : <Lock size={18} />
            ) : (
              <MapPinOff size={18} />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-[#111827]">
              {asset.name}
            </h2>
            <p className="mt-1 truncate text-[12px] text-[#718096]">{asset.code}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-[5px] px-2 py-1 text-[12px] font-semibold ${
            isAlarm
              ? "bg-[#fff1f2] text-[#ef4444]"
              : asset.status === "Offline"
                ? "bg-[#f1f5f9] text-[#64748b]"
                : asset.status === "Idle"
                  ? "bg-[#fff7ed] text-[#f97316]"
                  : "bg-[#ecfdf5] text-[#16883f]"
          }`}
        >
          {asset.status}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-[#64748b]">
        <span className="flex items-center gap-1.5">
          <BatteryIcon size={14} className={batteryColor} />
          {asset.battery}
        </span>

        <span className="flex items-center gap-1.5">
          {asset.lock === "Locked" ? (
            <Lock size={14} className="text-[#059669]" />
          ) : asset.lock === "Unlocked" ? (
            <Unlock size={14} className="text-[#eab308]" />
          ) : (
            <Lock size={14} className="text-[#94a3b8]" />
          )}
          {asset.lock}
        </span>
      </div>
    </button>
  );
}