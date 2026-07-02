"use client";

import { DivIcon } from "leaflet";
import { useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type MapLayerMode = "plan" | "satellite";

const PLAN_LAYER = {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  maxNativeZoom: 20,
  maxZoom: 20,
  url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
};

const SATELLITE_LAYER = {
  attribution: "Tiles &copy; Esri",
  maxNativeZoom: 17,
  maxZoom: 18,
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

function MapLayerSwitch({ activeLayer, onLayerChange }: { activeLayer: MapLayerMode; onLayerChange: (layer: MapLayerMode) => void }) {
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control mr-3 mt-3 flex overflow-hidden rounded-[8px] border border-[#dfe6ee] bg-white/95 p-1 text-[11px] font-bold shadow-sm backdrop-blur">
        {[{ key: "plan" as const, label: "Plan" }, { key: "satellite" as const, label: "Satellite" }].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onLayerChange(item.key)}
            className={"h-8 rounded-[6px] px-3 transition " + (activeLayer === item.key ? "bg-[#111827] text-white" : "text-[#475569] hover:bg-[#f3f7fa]")}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function alarmLockIcon() {
  return new DivIcon({
    className: "",
    html:
      '<div style="width:42px;height:42px;display:grid;place-items:center;border-radius:999px;border:3px solid #fee2e2;background:#dc2626;color:white;box-shadow:0 0 0 2px white,0 12px 22px rgba(15,23,42,0.26);">' +
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="10" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
      '</div>',
    iconAnchor: [21, 21],
    popupAnchor: [0, -18],
  });
}

type AlarmPositionMapProps = {
  position: [number, number];
  label: string;
};

export function AlarmPositionMap({ position, label }: AlarmPositionMapProps) {
  const [activeLayer, setActiveLayer] = useState<MapLayerMode>("plan");
  const tileLayer = activeLayer === "plan" ? PLAN_LAYER : SATELLITE_LAYER;

  return (
    <MapContainer
      center={position}
      zoom={16}
      minZoom={2}
      maxZoom={18}
      scrollWheelZoom
      zoomControl={false}
      className="absolute inset-0 z-0"
    >
      <TileLayer
        attribution={tileLayer.attribution}
        maxNativeZoom={tileLayer.maxNativeZoom}
        maxZoom={tileLayer.maxZoom}
        url={tileLayer.url}
      />
      <ZoomControl position="topleft" />
      <MapLayerSwitch activeLayer={activeLayer} onLayerChange={setActiveLayer} />
      <Marker position={position} icon={alarmLockIcon()}>
        <Popup closeButton={false} className="fleet-asset-popup">
          <div className="w-[210px] rounded-[8px] bg-white px-3 py-2 text-[12px] text-[#0f172a]">
            <p className="font-bold">{label}</p>
            <p className="mt-1 text-[#64748b]">{position[0].toFixed(6)}, {position[1].toFixed(6)}</p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
