"use client";

import { DivIcon } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { liveMapAssets } from "./live-map-data";

function markerIcon(color: string) {
  return new DivIcon({
    className: "",
    html: `
      <div style="
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        border: 3px solid white;
        background: ${color};
        color: white;
        box-shadow: 0 12px 22px rgba(15, 23, 42, 0.22);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 17h4V5H2v12h3"/>
          <path d="M14 17h1V9h4l3 4v4h-2"/>
          <circle cx="7.5" cy="17.5" r="2.5"/>
          <circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
      </div>
    `,
    iconAnchor: [20, 20],
  });
}

function AssetFocusHandler() {
  const map = useMap();

  useEffect(() => {
    function handleFocus(event: Event) {
      const assetEvent = event as CustomEvent<{ position: [number, number] }>;

      if (assetEvent.detail?.position) {
        map.flyTo(assetEvent.detail.position, 10, {
          animate: true,
          duration: 1.1,
        });
      }
    }

    window.addEventListener("fleet:focus-asset", handleFocus);

    return () => {
      window.removeEventListener("fleet:focus-asset", handleFocus);
    };
  }, [map]);

  return null;
}

export function LiveMapView() {
  return (
    <MapContainer
      center={[31.7917, -7.0926]}
      zoom={6}
      minZoom={2}
      maxZoom={18}
      scrollWheelZoom
      zoomControl={false}
      className="absolute inset-0 z-0"
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxNativeZoom={18}
        maxZoom={18}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="topleft" />
      <AssetFocusHandler />
      {liveMapAssets.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          icon={markerIcon(marker.color)}
        />
      ))}
    </MapContainer>
  );
}
