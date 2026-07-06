"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getStoredAccessToken, warmAppCache } from "../lib/api";
import loginBg from "../public/images/loginBg.png";
import logo from "../public/images/logo.png";

const MIN_SPLASH_MS = 1200;
const SPLASH_SESSION_KEY = "pad_lock_splash_seen";

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function SplashPreloader() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    function shouldShowSplash() {
      const navigation = window.performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const isReload = navigation?.type === "reload";
      const hasSeenSplash = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "true";

      return isReload || !hasSeenSplash;
    }

    async function run(showSplash: boolean) {
      if (showSplash) {
        window.sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
        setIsVisible(true);
      }

      const tasks: Promise<unknown>[] = showSplash ? [wait(MIN_SPLASH_MS)] : [];

      if (getStoredAccessToken()) {
        window.setTimeout(() => {
          void warmAppCache();
        }, 2500);
      }

      if (tasks.length === 0) {
        return;
      }

      await Promise.allSettled(tasks);

      if (isMounted) {
        setIsVisible(false);
      }
    }

    function handleTokenStored() {
      run(false);
    }

    run(shouldShowSplash());
    window.addEventListener("pad-lock:token-stored", handleTokenStored);

    return () => {
      isMounted = false;
      window.removeEventListener("pad-lock:token-stored", handleTokenStored);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-white">
      <Image
        src={loginBg}
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-105 object-cover blur-[7px]"
      />
      <div className="absolute inset-0 bg-white/55" />

      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="relative flex animate-[splashRise_900ms_ease-out] flex-col items-center">
          <Image
            src={logo}
            alt="Administration des Douanes et Impots Indirect logo"
            width={92}
            height={140}
            priority
            className="h-auto w-[96px] drop-shadow-[0_16px_28px_rgba(15,23,42,0.16)]"
          />
          <p className="mt-3 text-center text-[15px] font-medium leading-tight text-[#111827]">
            Royaume Du Maroc Administration
            <br />
            Des Douanes Et Impots Indirect
          </p>
          <span className="absolute right-0 top-2 grid size-9 place-items-center rounded-full bg-[#718096] text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(15,23,42,0.28)]">
            <span className="absolute inset-0 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
            R
          </span>
          <span className="mt-5 h-1 w-36 overflow-hidden rounded-full bg-white/80 shadow-inner">
            <span className="block h-full w-1/2 animate-[splashBar_1100ms_ease-in-out_infinite] rounded-full bg-[#718096]" />
          </span>
        </div>
      </div>
    </div>
  );
}

