"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(
  () => import("./live-map-view").then((module) => module.LiveMapView),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[#d8eadf]" />,
  },
);

export function LiveMapShell() {
  return <LeafletMap />;
}
