"use client";

import { Bell } from "lucide-react";
import { AlarmNotificationBadge } from "./alarm-notification-badge";

export function HeaderNotificationButton() {
  return (
    <button
      className="relative grid size-8 place-items-center rounded-[6px] border border-[#dfe6ee] text-[#64748b] transition hover:border-[#2A9D90] hover:text-[#2A9D90]"
      type="button"
      aria-label="Notifications"
      title="Notifications"
    >
      <Bell size={15} />
      <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[#050816] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
        <AlarmNotificationBadge />
      </span>
    </button>
  );
}