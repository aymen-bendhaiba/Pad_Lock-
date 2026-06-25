"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAccessToken } from "../lib/api";

export function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    clearAccessToken();
    router.replace("/");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-full text-left"
      aria-label="Logout and return to login"
      title="Logout"
    >
      <span className="grid size-10 place-items-center rounded-full bg-[#111827] text-[14px] font-bold text-white">
        AA
      </span>
      <ChevronDown className="hidden text-[#718096] sm:block" size={15} />
    </button>
  );
}
