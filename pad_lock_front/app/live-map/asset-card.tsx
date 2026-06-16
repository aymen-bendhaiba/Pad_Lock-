"use client";

import { BatteryMedium, Lock, SignalHigh, Truck, Unlock } from "lucide-react";

type AssetCardProps = {
  asset: {
    name: string;
    code: string;
    status: string;
    color: string;
    battery: string;
    lock: string;
    position: [number, number];
  };
};

export function AssetCard({ asset }: AssetCardProps) {
  function focusAsset() {
    window.dispatchEvent(
      new CustomEvent("fleet:focus-asset", {
        detail: { position: asset.position },
      }),
    );
  }

  return (
    <button
      type="button"
      onClick={focusAsset}
      className="block w-full rounded-[9px] p-4 text-left transition hover:bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span
            className="grid size-10 place-items-center rounded-[8px] text-white"
            style={{ backgroundColor: asset.color }}
          >
            <Truck size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[#111827]">
              {asset.name}
            </h2>
            <p className="mt-1 text-[12px] text-[#718096]">{asset.code}</p>
          </div>
        </div>
        <span
          className={`rounded-[5px] px-2 py-1 text-[12px] font-semibold ${
            asset.status === "Alarm"
              ? "bg-[#fff1f2] text-[#ef4444]"
              : "bg-[#ecfdf5] text-[#16883f]"
          }`}
        >
          {asset.status}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-[#64748b]">
        <span className="flex items-center gap-1.5">
          <BatteryMedium size={14} className="text-[#059669]" />
          {asset.battery}
        </span>
        <span className="flex items-center gap-1.5">
          <SignalHigh size={14} className="text-[#cbd5e1]" />
          Excellent
        </span>
        <span className="flex items-center gap-1.5">
          {asset.lock === "Locked" ? (
            <Lock size={14} className="text-[#059669]" />
          ) : (
            <Unlock size={14} className="text-[#eab308]" />
          )}
          {asset.lock}
        </span>
      </div>
    </button>
  );
}
