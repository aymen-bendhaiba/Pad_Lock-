"use client";

import dynamic from "next/dynamic";

const AlarmPositionMap = dynamic(
  () => import("./alarm-position-map").then((module) => module.AlarmPositionMap),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[#d8eadf]" />,
  },
);

type AlarmPositionMapShellProps = {
  position: [number, number];
  label: string;
};

export function AlarmPositionMapShell(props: AlarmPositionMapShellProps) {
  return <AlarmPositionMap {...props} />;
}
