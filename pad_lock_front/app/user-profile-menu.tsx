"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearAccessToken, getStoredUserProfile, type StoredUserProfile } from "../lib/api";

const DEFAULT_PROFILE: StoredUserProfile = {
  name: "User",
  email: "user@harmony.ma",
  initials: "U",
};

export function UserProfileMenu() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<StoredUserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    let hydrationTimer: number | null = null;

    function refreshProfile() {
      setProfile(getStoredUserProfile());
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    hydrationTimer = window.setTimeout(refreshProfile, 0);
    window.addEventListener("pad-lock:user-updated", refreshProfile);
    window.addEventListener("storage", refreshProfile);
    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      if (hydrationTimer) {
        window.clearTimeout(hydrationTimer);
      }

      window.removeEventListener("pad-lock:user-updated", refreshProfile);
      window.removeEventListener("storage", refreshProfile);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, []);

  function handleLogout() {
    clearAccessToken();
    setIsOpen(false);
    router.replace("/");
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-3">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-3 rounded-[8px] px-1.5 py-1 text-left transition hover:bg-[#f3f7fa] focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/20"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="hidden text-right md:block">
          <span className="block max-w-[160px] truncate text-[13px] font-semibold text-[#111827]">
            {profile.name}
          </span>
          <span className="block max-w-[180px] truncate text-[12px] text-[#718096]">
            {profile.email}
          </span>
        </span>
        <span className="grid size-10 place-items-center rounded-full bg-[#111827] text-[14px] font-bold text-white">
          {profile.initials}
        </span>
        <ChevronDown className={`hidden text-[#718096] transition sm:block ${isOpen ? "rotate-180" : ""}`} size={15} />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[250px] rounded-[8px] border border-[#dfe6ee] bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
        >
          <div className="flex items-center gap-3 rounded-[7px] bg-[#f8fafc] px-3 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#111827] text-[13px] font-bold text-white">
              {profile.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-[#111827]">{profile.name}</span>
              <span className="block truncate text-[12px] text-[#718096]">{profile.email}</span>
            </span>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="mt-2 flex h-10 w-full items-center gap-2 rounded-[7px] px-3 text-[13px] font-semibold text-[#dc2626] transition hover:bg-[#fef2f2]"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}