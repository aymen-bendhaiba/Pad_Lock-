export type LiveMapStatus = "Online" | "Moving" | "Charging" | "Idle" | "Offline" | "Alarm";
export type LiveMapLockState = "Locked" | "Unlocked" | "Unknown";

export type LiveMapPlaybackPoint = {
  position: [number, number];
  timestamp: string | undefined;
  placeName?: string;
};

export type LiveMapDeviceDetail = {
  label: string;
  value: string;
};

export type LiveMapAsset = {
  id: string;
  terminalId: string;
  name: string;
  code: string;
  status: LiveMapStatus;
  color: string;
  battery: string;
  signal: string;
  lock: LiveMapLockState;
  isCharging: boolean;
  position?: [number, number];
  updatedAt?: string;
  deviceDetails: LiveMapDeviceDetail[];
};

export const LIVE_MAP_COLORS: Record<LiveMapStatus, string> = {
  Online: "#16a34a",
  Moving: "#2563eb",
  Charging: "#8b5cf6",
  Idle: "#f59e0b",
  Offline: "#94a3b8",
  Alarm: "#dc2626",
};