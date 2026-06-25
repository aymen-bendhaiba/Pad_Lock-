"use client";

import { useEffect } from "react";

export function AlarmNotificationReset() {
  useEffect(() => {
    window.localStorage.setItem("pad_lock_alarms_viewed_at", String(Date.now()));
    window.dispatchEvent(new CustomEvent("pad-lock:alarms-viewed"));
  }, []);

  return null;
}