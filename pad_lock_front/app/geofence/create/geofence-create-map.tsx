"use client";

import { DivIcon, LatLngExpression, Marker as LeafletMarker } from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngTuple } from "../geofence-types";

const moroccoCenter: LatLngExpression = [31.7917, -7.0926];

function redPinIcon(label?: string) {
  return new DivIcon({
    className: "",
    html: `
      <div style="
        position: relative;
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border-radius: 999px 999px 999px 0;
        border: 3px solid white;
        background: #dc2626;
        color: white;
        box-shadow: 0 12px 22px rgba(15, 23, 42, 0.24);
        transform: rotate(-45deg);
        font: 700 11px/1 Arial, sans-serif;
      ">
        <span style="transform: rotate(45deg);">${label ?? ""}</span>
      </div>
    `,
    iconAnchor: [15, 30],
  });
}

function DrawingEvents({
  shapeMode,
  draftPoints,
  isDrawing,
  onDraftPointsChange,
}: {
  shapeMode: "circle" | "polygon" | "route" | null;
  draftPoints: LatLngTuple[];
  isDrawing: boolean;
  onDraftPointsChange: (points: LatLngTuple[]) => void;
}) {
  useMapEvents({
    click(event) {
      if (!isDrawing || !shapeMode) return;

      const nextPoint: LatLngTuple = [event.latlng.lat, event.latlng.lng];
      onDraftPointsChange(
        shapeMode === "circle" ? [nextPoint] : [...draftPoints, nextPoint],
      );
    },
    contextmenu() {
      if (!isDrawing) return;
      onDraftPointsChange(draftPoints.slice(0, -1));
    },
  });

  return null;
}

type GeofenceCreateMapProps = {
  draftPoints: LatLngTuple[];
  shapeMode: "circle" | "polygon" | "route" | null;
  isDrawing: boolean;
  circleRadiusMeters: number;
  onDraftPointsChange: (points: LatLngTuple[]) => void;
};

export function GeofenceCreateMap({
  draftPoints,
  shapeMode,
  isDrawing,
  circleRadiusMeters,
  onDraftPointsChange,
}: GeofenceCreateMapProps) {
  const circleCenter = draftPoints[0];

  function movePoint(index: number, marker: LeafletMarker) {
    const position = marker.getLatLng();
    const nextPoints = draftPoints.map((point, pointIndex): LatLngTuple =>
      pointIndex === index ? [position.lat, position.lng] : point,
    );

    onDraftPointsChange(nextPoints);
  }

  return (
    <MapContainer
      center={moroccoCenter}
      zoom={6}
      minZoom={2}
      maxZoom={17}
      scrollWheelZoom
      zoomControl={false}
      className="absolute inset-0 z-0"
      worldCopyJump
    >
      <TileLayer
        attribution="Tiles &copy; Esri"
        maxNativeZoom={17}
        maxZoom={17}
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <ZoomControl position="topleft" />
      <DrawingEvents
        draftPoints={draftPoints}
        shapeMode={shapeMode}
        isDrawing={isDrawing}
        onDraftPointsChange={onDraftPointsChange}
      />

      {shapeMode === "circle" && circleCenter ? (
        <Circle
          center={circleCenter}
          radius={circleRadiusMeters}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#60a5fa",
            fillOpacity: 0.14,
            weight: 2,
          }}
        />
      ) : shapeMode === "polygon" && draftPoints.length >= 3 ? (
        <Polygon
          positions={draftPoints}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#60a5fa",
            fillOpacity: 0.12,
            weight: 3,
          }}
        />
      ) : null}

      {(shapeMode === "route" || (shapeMode === "polygon" && draftPoints.length < 3)) && draftPoints.length >= 2 ? (
        <Polyline
          positions={draftPoints}
          pathOptions={{
            color: shapeMode === "route" ? "#f97316" : "#2563eb",
            dashArray: shapeMode === "route" ? "10 8" : "6 8",
            weight: shapeMode === "route" ? 4 : 3,
          }}
        />
      ) : null}

      {draftPoints.map((point, index) => (
        <Marker
          key={`${index}-${point[0]}-${point[1]}`}
          position={point}
          icon={redPinIcon(index === 0 ? "" : String(index + 1))}
          draggable
          eventHandlers={{
            dragend: (event) => movePoint(index, event.target as LeafletMarker),
          }}
        >
          <Tooltip direction="top" offset={[0, -28]}>
            Point {index + 1}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}