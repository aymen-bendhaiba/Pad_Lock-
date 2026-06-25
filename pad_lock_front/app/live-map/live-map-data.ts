export type LiveMapStatus = "Moving" | "Idle" | "Offline" | "Alarm";
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
  position?: [number, number];
  updatedAt?: string;
  deviceDetails: LiveMapDeviceDetail[];
};

export const LIVE_MAP_COLORS: Record<LiveMapStatus, string> = {
  Moving: "#047857",
  Idle: "#f59e0b",
  Offline: "#94a3b8",
  Alarm: "#dc2626",
};