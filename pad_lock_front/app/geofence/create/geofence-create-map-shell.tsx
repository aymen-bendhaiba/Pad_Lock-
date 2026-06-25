"use client";

import dynamic from "next/dynamic";
import type { LatLngTuple } from "../geofence-types";

const LeafletGeofenceCreateMap = dynamic(
  () => import("./geofence-create-map").then((module) => module.GeofenceCreateMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[#eef3f7]" />,
  },
);

type GeofenceCreateMapShellProps = {
  draftPoints: LatLngTuple[];
  shapeMode: "circle" | "polygon" | "route" | null;
  isDrawing: boolean;
  circleRadiusMeters: number;
  onDraftPointsChange: (points: LatLngTuple[]) => void;
};

export function GeofenceCreateMapShell(props: GeofenceCreateMapShellProps) {
  return <LeafletGeofenceCreateMap {...props} />;
}