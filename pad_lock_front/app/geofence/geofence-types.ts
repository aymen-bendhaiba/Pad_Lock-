export type LatLngTuple = [number, number];

export type ShapeType = "circle" | "polygon" | "route";

export type GeofenceAccessMode = "allow_inside" | "allow_outside";

export type BoundarySummary = {
  id: string;
  name: string;
  type: string;
  countryCode?: string;
  continent?: string;
};

export type GeofenceDraft = {
  shapeType: ShapeType;
  points: LatLngTuple[];
  radiusMeters: number;
};

export type SavedGeofence = {
  id: string;
  name: string;
  number: string;
  description: string;
  area: string;
  shapeType: ShapeType;
  points: LatLngTuple[];
  rings?: LatLngTuple[][];
  radiusMeters: number;
  accessMode: GeofenceAccessMode;
  lockAccessAllowed: boolean;
  source: "custom" | "boundary";
  syncStatus: "local" | "synced";
  geoBoundaryId?: string;
  countryCode?: string;
  countryName?: string;
};

export type LockMapAsset = {
  id: string;
  name: string;
  status: "Moving" | "Idle" | "Offline" | "Alarm";
  lock: "Locked" | "Unlocked" | "Unknown";
  battery?: string;
  updatedAt?: string;
  position: LatLngTuple;
};