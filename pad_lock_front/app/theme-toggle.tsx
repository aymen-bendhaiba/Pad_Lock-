"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const themeStorageKey = "pad-lock-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
      setIsMounted(true);
    });
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;

    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem(themeStorageKey, nextDark ? "dark" : "light");
    setIsDark(nextDark);
  }

  const label = isMounted && isDark ? "Passer au theme clair" : "Passer au theme sombre";
  const title = isMounted && isDark ? "Theme clair" : "Theme sombre";

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={toggleTheme}
      className="grid size-9 place-items-center rounded-[7px] border border-[#dfe6ee] bg-white text-[#64748b] transition hover:bg-[#f3f7fa] hover:text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#2A9D90]/20"
      suppressHydrationWarning
    >
      {isMounted && isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
