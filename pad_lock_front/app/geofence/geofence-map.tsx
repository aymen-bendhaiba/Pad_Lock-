"use client";

import { DivIcon, LatLngBounds, LatLngExpression } from "leaflet";
import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Polygon,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngTuple, LockMapAsset, SavedGeofence } from "./geofence-types";

const moroccoCenter: LatLngExpression = [31.7917, -7.0926];

const GOOGLE_MAP_LAYER = {
  attribution: "Donnees cartographiques &copy; Google",
  maxNativeZoom: 20,
  maxZoom: 20,
  url: "https://mt1.google.com/vt/lyrs=y&hl=fr&gl=MA&x={x}&y={y}&z={z}",
};

const lockStatusColors: Record<LockMapAsset["status"], string> = {
  Moving: "#047857",
  Idle: "#f59e0b",
  Offline: "#94a3b8",
  Alarm: "#dc2626",
};

function statusLabel(status: LockMapAsset["status"]) {
  return status === "Moving"
    ? "En mouvement"
    : status === "Idle"
      ? "A l'arret"
      : status === "Offline"
        ? "Hors ligne"
        : "Alarme";
}

function lockLabel(lock: LockMapAsset["lock"]) {
  return lock === "Locked" ? "Verrouille" : lock === "Unlocked" ? "Deverrouille" : "Inconnu";
}
function lockIcon(color: string, lockState: LockMapAsset["lock"]) {
  const lockAccent = lockState === "Unlocked" ? "#f59e0b" : lockState === "Locked" ? "#10b981" : "white";
  const lockSvg = lockState === "Unlocked"
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="10" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.4-2.1"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="10" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  return new DivIcon({
    className: "",
    html:
      '<div style="width:40px;height:40px;display:grid;place-items:center;border-radius:999px;border:3px solid ' +
      lockAccent +
      ';background:' +
      color +
      ';color:white;box-shadow:0 0 0 2px white,0 12px 22px rgba(15,23,42,0.22);">' +
      lockSvg +
      '</div>',
    iconAnchor: [20, 20],
    popupAnchor: [0, -18],
  });
}

function geofencePositions(geofence: SavedGeofence) {
  return [
    ...geofence.points,
    ...(geofence.rings ?? []).flat(),
  ].filter((point): point is LatLngTuple => Boolean(point));
}

function SelectedGeofenceFocus({
  savedGeofences,
  selectedGeofenceId,
  countryCenter,
  countryRings,
}: {
  savedGeofences: SavedGeofence[];
  selectedGeofenceId: string | null;
  countryCenter: [number, number] | null;
  countryRings: LatLngTuple[][];
}) {
  const map = useMap();

  useEffect(() => {
    const selectedGeofence = selectedGeofenceId
      ? savedGeofences.find((item) => item.id === selectedGeofenceId)
      : undefined;
    const positions = selectedGeofence
      ? geofencePositions(selectedGeofence)
      : countryRings.flat();

    if (positions.length > 1) {
      const frame = window.requestAnimationFrame(() => {
        map.invalidateSize();
        map.fitBounds(new LatLngBounds(positions), {
          animate: true,
          duration: 0.8,
          padding: [50, 50],
          maxZoom:
            selectedGeofence?.shapeType === "circle"
              ? 13
              : selectedGeofence
                ? 11
                : 7,
        });
      });

      return () => window.cancelAnimationFrame(frame);
    }

    const target = positions[0] ?? countryCenter ?? countryRings[0]?.[0];

    if (target) {
      map.flyTo(target, selectedGeofence ? 11 : 7, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [countryCenter, countryRings, map, savedGeofences, selectedGeofenceId]);

  return null;
}

type GeofenceMapProps = {
  savedGeofences: SavedGeofence[];
  selectedGeofenceId: string | null;
  countryCenter: [number, number] | null;
  countryRings: LatLngTuple[][];
  lockAssets: LockMapAsset[];
};

export function GeofenceMap({
  savedGeofences,
  selectedGeofenceId,
  countryCenter,
  countryRings,
  lockAssets,
}: GeofenceMapProps) {
  const tileLayer = GOOGLE_MAP_LAYER;

  return (
    <MapContainer
      center={moroccoCenter}
      zoom={7}
      minZoom={2}
      maxZoom={tileLayer.maxZoom}
      scrollWheelZoom
      zoomControl={false}
      className="absolute inset-0 z-0"
      worldCopyJump
    >
      <TileLayer
        attribution={tileLayer.attribution}
        maxNativeZoom={tileLayer.maxNativeZoom}
        maxZoom={tileLayer.maxZoom}
        url={tileLayer.url}
      />
      <ZoomControl position="topleft" />
      <SelectedGeofenceFocus
        savedGeofences={savedGeofences}
        selectedGeofenceId={selectedGeofenceId}
        countryCenter={countryCenter}
        countryRings={countryRings}
      />

      {lockAssets.map((asset) => (
        <Marker
          key={asset.id}
          position={asset.position}
          icon={lockIcon(lockStatusColors[asset.status], asset.lock)}
        >
          <Popup closeButton={false} className="fleet-asset-popup">
            <div className="w-[220px] overflow-hidden rounded-[10px] text-[#0f172a]">
              <div className="border-b border-[#e6edf5] bg-[#f8fafc] px-3 py-3">
                <p className="truncate text-[14px] font-bold leading-tight">{asset.name}</p>
                <p className="mt-1 text-[11px] font-medium text-[#64748b]">{statusLabel(asset.status)}</p>
              </div>
              <div className="space-y-1 bg-white px-3 py-3 text-[11px]">
                <div className="flex items-center justify-between gap-3 rounded-[6px] bg-[#f8fafc] px-2.5 py-2">
                  <span className="font-semibold text-[#64748b]">Verrouillage</span>
                  <span className="font-bold text-[#111827]">{lockLabel(asset.lock)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[6px] bg-[#f8fafc] px-2.5 py-2">
                  <span className="font-semibold text-[#64748b]">Batterie</span>
                  <span className="font-bold text-[#111827]">{asset.battery ?? "--"}</span>
                </div>
                {asset.updatedAt ? (
                  <div className="rounded-[6px] bg-[#f8fafc] px-2.5 py-2 text-[#64748b]">
                    Derniere mise a jour : <span className="font-bold text-[#111827]">{asset.updatedAt}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {countryRings.map((ring, index) => (
        <Polygon
          key={`selected-country-halo-${index}`}
          positions={ring}
          pathOptions={{
            className: "geofence-country-halo",
            color: "#2A9D90",
            fillColor: "#2A9D90",
            fillOpacity: 0.18,
            opacity: 0.38,
            weight: 7,
          }}
        />
      ))}

      {countryRings.map((ring, index) => (
        <Polygon
          key={`selected-country-${index}`}
          positions={ring}
          pathOptions={{
            className: "geofence-country-wave",
            color: "#0f766e",
            fillColor: "#2A9D90",
            fillOpacity: 0.24,
            opacity: 0.95,
            weight: 3,
          }}
        />
      ))}

      {savedGeofences.map((geofence) =>
        geofence.source === "boundary" && geofence.id !== selectedGeofenceId ? null : geofence.rings?.length ? (
          geofence.rings.map((ring, index) => (
            <Polygon
              key={`saved-ring-${geofence.id}-${index}`}
              positions={ring}
              pathOptions={{
                color: geofence.id === selectedGeofenceId ? "#7c3aed" : "#f97316",
                fillColor: geofence.id === selectedGeofenceId ? "#8b5cf6" : "#fb923c",
                fillOpacity: 0.16,
                weight: geofence.id === selectedGeofenceId ? 3 : 2,
              }}
            />
          ))
        ) : geofence.shapeType === "circle" && geofence.points[0] ? (
          <Circle
            key={`saved-circle-${geofence.id}`}
            center={geofence.points[0]}
            radius={geofence.radiusMeters}
            pathOptions={{
              color: geofence.id === selectedGeofenceId ? "#7c3aed" : "#f97316",
              fillColor: geofence.id === selectedGeofenceId ? "#8b5cf6" : "#fb923c",
              fillOpacity: 0.16,
              weight: geofence.id === selectedGeofenceId ? 3 : 2,
            }}
          />
        ) : geofence.shapeType === "route" && geofence.points.length >= 2 ? (
          <Polyline
            key={`saved-route-${geofence.id}`}
            positions={geofence.points}
            pathOptions={{
              color: geofence.id === selectedGeofenceId ? "#7c3aed" : "#f97316",
              weight: geofence.id === selectedGeofenceId ? 5 : 3,
            }}
          />
        ) : geofence.points.length >= 3 ? (
          <Polygon
            key={`saved-polygon-${geofence.id}`}
            positions={geofence.points}
            pathOptions={{
              color: geofence.id === selectedGeofenceId ? "#7c3aed" : "#f97316",
              fillColor: geofence.id === selectedGeofenceId ? "#8b5cf6" : "#fb923c",
              fillOpacity: 0.16,
              weight: geofence.id === selectedGeofenceId ? 3 : 2,
            }}
          />
        ) : null,
      )}
    </MapContainer>
  );
}




