"use client";

import dynamic from "next/dynamic";
import type { LatLngTuple, LockMapAsset, SavedGeofence } from "./geofence-types";

const LeafletGeofenceMap = dynamic(
  () => import("./geofence-map").then((module) => module.GeofenceMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[#d8eadf]" />,
  },
);

type GeofenceMapShellProps = {
  savedGeofences: SavedGeofence[];
  selectedGeofenceId: string | null;
  countryCenter: [number, number] | null;
  countryRings: LatLngTuple[][];
  lockAssets: LockMapAsset[];
};

export function GeofenceMapShell(props: GeofenceMapShellProps) {
  return <LeafletGeofenceMap {...props} />;
}
