"use client";

import dynamic from "next/dynamic";
import type { LiveMapAsset, LiveMapPlaybackPoint } from "./live-map-data";

const LeafletMap = dynamic(
  () => import("./live-map-view").then((module) => module.LiveMapView),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[#d8eadf]" />,
  },
);

type LiveMapShellProps = {
  assets: LiveMapAsset[];
  playbackPoints: LiveMapPlaybackPoint[];
  playbackIndex: number;
  playbackAsset?: LiveMapAsset | null;
  isPlaybackOpen?: boolean;
};

export function LiveMapShell({ assets, playbackPoints, playbackIndex, playbackAsset, isPlaybackOpen }: LiveMapShellProps) {
  return (
    <LeafletMap
      assets={assets}
      playbackPoints={playbackPoints}
      playbackIndex={playbackIndex}
      playbackAsset={playbackAsset}
      isPlaybackOpen={isPlaybackOpen}
    />
  );
}