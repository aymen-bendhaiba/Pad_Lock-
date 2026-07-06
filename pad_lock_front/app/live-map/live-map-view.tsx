"use client";

import { DivIcon, LatLngBounds } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveMapAsset, LiveMapPlaybackPoint } from "./live-map-data";

const GOOGLE_MAP_LAYER = {
  attribution: "Donnees cartographiques &copy; Google",
  maxNativeZoom: 20,
  maxZoom: 20,
  url: "https://mt1.google.com/vt/lyrs=y&hl=fr&gl=MA&x={x}&y={y}&z={z}",
};

const MIN_MAP_ZOOM = 3;

const markerIconCache = new globalThis.Map<string, DivIcon>();

const reverseGeocodeMemory = new globalThis.Map<string, string>();

function statusLabel(status: LiveMapAsset["status"]) {
  return status === "Moving"
    ? "En mouvement"
    : status === "Charging"
      ? "En charge"
      : status === "Online"
        ? "En ligne"
      : status === "Idle"
          ? "A l'arret"
          : status === "Offline"
            ? "Hors ligne"
            : "Alarme";
}

function detailLabel(label: string) {
  const labels: Record<string, string> = {
    Location: "Lieu",
    "Terminal ID": "ID terminal",
    Device: "PadLock",
    Status: "Statut",
    Battery: "Batterie",
    Charging: "Recharge",
    Locked: "Verrouillage",
    Online: "En ligne",
    Speed: "Vitesse",
  };

  return labels[label] ?? label;
}

function detailValue(label: string, value: string) {
  if (value === "Yes") return "Oui";
  if (value === "No") return "Non";
  if (label === "Status") return value === "Moving" ? "En mouvement" : value === "Charging" ? "En charge" : value === "Online" ? "En ligne" : value === "Idle" ? "A l'arret" : value === "Offline" ? "Hors ligne" : value === "Alarm" ? "Alarme" : value;
  if (label === "Locked") return value === "Locked" ? "Verrouille" : value === "Unlocked" ? "Deverrouille" : value;
  if (label === "Charging") return value === "true" || value === "Yes" ? "En charge" : value === "false" || value === "No" ? "Non" : value;
  return value;
}

function reverseGeocodeKey(position: [number, number]) {
  return position.map((value) => value.toFixed(5)).join(",");
}

function placeFromNominatim(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as { display_name?: string; name?: string; address?: Record<string, string | undefined> };
  const address = record.address ?? {};
  const compact = [
    address.road ?? address.neighbourhood ?? address.suburb ?? record.name,
    address.city ?? address.town ?? address.village ?? address.municipality,
    address.state ?? address.region,
    address.country,
  ].filter(Boolean).join(", ");

  return compact || record.display_name;
}

function isDeviceNameLocation(value: string | undefined, asset: LiveMapAsset) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === asset.name.toLowerCase()
    || normalized === asset.code.toLowerCase()
    || normalized === asset.terminalId.toLowerCase()
    || normalized.startsWith("lock ")
    || normalized.startsWith("device-")
    || normalized.includes(asset.terminalId.toLowerCase());
}
function useReverseGeocode(position: [number, number] | undefined, enabled: boolean) {
  const [place, setPlace] = useState<string | undefined>();
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!position || !enabled) return;

    let isMounted = true;
    const key = reverseGeocodeKey(position);
    const storageKey = "pad-lock:place:" + key;
    const memoryValue = reverseGeocodeMemory.get(key);
    const storageValue = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;

    if (memoryValue || storageValue) {
      const cachedPlace = memoryValue ?? storageValue ?? undefined;
      const timer = window.setTimeout(() => {
        if (isMounted) setPlace(cachedPlace);
      }, 0);
      return () => {
        isMounted = false;
        window.clearTimeout(timer);
      };
    }

    const resolvingTimer = window.setTimeout(() => {
      if (isMounted) setIsResolving(true);
    }, 0);
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(position[0]),
      lon: String(position[1]),
      zoom: "16",
      addressdetails: "1",
    });

    fetch("https://nominatim.openstreetmap.org/reverse?" + params.toString(), {
      headers: { Accept: "application/json" },
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!isMounted) return;
        const nextPlace = placeFromNominatim(payload);
        if (nextPlace) {
          reverseGeocodeMemory.set(key, nextPlace);
          window.localStorage.setItem(storageKey, nextPlace);
          setPlace(nextPlace);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsResolving(false);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(resolvingTimer);
    };
  }, [enabled, position]);

  return { place, isResolving };
}

function markerIcon(color: string, lockState: LiveMapAsset["lock"]) {
  const cacheKey = color + ":" + lockState;
  const cached = markerIconCache.get(cacheKey);
  if (cached) return cached;

  const lockAccent = lockState === "Unlocked" ? "#f59e0b" : lockState === "Locked" ? "#10b981" : "white";
  const lockIcon = lockState === "Unlocked"
    ? `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="14" height="10" x="5" y="11" rx="2"/>
        <path d="M8 11V7a4 4 0 0 1 7.4-2.1"/>
      </svg>
    `
    : `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="14" height="10" x="5" y="11" rx="2"/>
        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
      </svg>
    `;

  const icon = new DivIcon({
    className: "",
    html: `
      <div style="
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        border: 3px solid ${lockAccent};
        background: ${color};
        color: white;
        box-shadow: 0 0 0 2px white, 0 12px 22px rgba(15, 23, 42, 0.22);
      ">
        ${lockIcon}
      </div>
    `,
    iconAnchor: [20, 20],
    popupAnchor: [0, -18],
  });
  markerIconCache.set(cacheKey, icon);
  return icon;
}

function AssetFocusHandler() {
  const map = useMap();

  useEffect(() => {
    function handleFocus(event: Event) {
      const assetEvent = event as CustomEvent<{ position: [number, number] }>;

      if (assetEvent.detail?.position) {
        map.flyTo(assetEvent.detail.position, map.getMaxZoom(), {
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

function FitVisibleAssets({ assets }: { assets: LiveMapAsset[] }) {
  const map = useMap();
  const didAutoFitRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const positionedAssets = useMemo(
    () => assets.filter((asset) => asset.position),
    [assets],
  );

  useEffect(() => {
    const container = map.getContainer();
    const markUserMove = () => {
      userMovedMapRef.current = true;
    };

    container.addEventListener("wheel", markUserMove, { passive: true });
    container.addEventListener("pointerdown", markUserMove);
    container.addEventListener("touchstart", markUserMove, { passive: true });

    return () => {
      container.removeEventListener("wheel", markUserMove);
      container.removeEventListener("pointerdown", markUserMove);
      container.removeEventListener("touchstart", markUserMove);
    };
  }, [map]);

  useEffect(() => {
    if (didAutoFitRef.current || userMovedMapRef.current) {
      return;
    }

    if (!positionedAssets.length) {
      map.setView([31.7917, -7.0926], 6);
      return;
    }

    didAutoFitRef.current = true;

    if (positionedAssets.length === 1) {
      map.setView(positionedAssets[0].position!, 12);
      return;
    }

    const bounds = new LatLngBounds(positionedAssets.map((asset) => asset.position!));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 12 });
  }, [map, positionedAssets]);

  return null;
}

function MapControls() {
  const map = useMap();

  useEffect(() => {
    map.setMinZoom(MIN_MAP_ZOOM);
    map.setMaxZoom(GOOGLE_MAP_LAYER.maxZoom);

    if (map.getZoom() > GOOGLE_MAP_LAYER.maxZoom) map.setZoom(GOOGLE_MAP_LAYER.maxZoom);
    if (map.getZoom() < MIN_MAP_ZOOM) map.setZoom(MIN_MAP_ZOOM);
  }, [map]);

  return (
    <div className="leaflet-top leaflet-left">
      <div className="leaflet-control ml-3 mt-3 overflow-hidden rounded-[10px] border border-[#dfe6ee] bg-white/95 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="grid size-10 place-items-center text-[#111827] transition hover:bg-[#f3f7fa] focus:bg-[#f3f7fa] focus:outline-none disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
          aria-label="Zoom avant"
          title="Zoom avant"
          disabled={map.getZoom() >= map.getMaxZoom()}
        >
          <Plus size={18} strokeWidth={2.3} />
        </button>
        <div className="h-px bg-[#dfe6ee]" />
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="grid size-10 place-items-center text-[#111827] transition hover:bg-[#f3f7fa] focus:bg-[#f3f7fa] focus:outline-none disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
          aria-label="Zoom arriere"
          title="Zoom arriere"
          disabled={map.getZoom() <= MIN_MAP_ZOOM}
        >
          <Minus size={18} strokeWidth={2.3} />
        </button>
      </div>
    </div>
  );
}

function PlaybackOverlay({
  points,
  index,
  playbackAsset,
}: {
  points: LiveMapPlaybackPoint[];
  index: number;
  playbackAsset?: LiveMapAsset | null;
}) {
  const map = useMap();
  const positions = useMemo(() => points.map((point) => point.position), [points]);
  const activePoint = points[index];
  const displayPosition = activePoint?.position ?? positions[0] ?? playbackAsset?.position;
  const fittedRouteKey = useRef("");
  const routeKey = useMemo(
    () => positions.length ? positions.map((position) => position.join(",")).join("|") : playbackAsset?.id ?? "",
    [playbackAsset?.id, positions],
  );

  useEffect(() => {
    if (fittedRouteKey.current === routeKey) {
      return;
    }

    fittedRouteKey.current = routeKey;

    if (positions.length > 1) {
      map.fitBounds(new LatLngBounds(positions), { padding: [70, 70], maxZoom: 15 });
      return;
    }

    const target = positions[0] ?? playbackAsset?.position;

    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 15), { animate: true, duration: 0.8 });
    }
  }, [map, playbackAsset?.position, positions, routeKey]);

  useEffect(() => {
    if (activePoint) {
      map.panTo(activePoint.position, { animate: true, duration: 0.35 });
    }
  }, [activePoint, map]);

  if (!displayPosition) {
    return null;
  }

  return (
    <>
      {positions.length > 1 ? (
        <Polyline
          positions={positions}
          pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.88 }}
        />
      ) : null}
      <Marker
        position={displayPosition}
        icon={markerIcon(playbackAsset?.color ?? "#2563eb", playbackAsset?.lock ?? "Locked")}
      >
        <Popup closeButton={false} className="fleet-asset-popup">
          <div className="rounded-[8px] bg-white px-3 py-2 text-[12px] font-semibold text-[#111827]">
            {activePoint?.placeName ?? playbackAsset?.name ?? "Position de playback"}
          </div>
        </Popup>
      </Marker>
    </>
  );
}
function AssetPopupContent({ asset, shouldResolveLocation }: { asset: LiveMapAsset; shouldResolveLocation: boolean }) {
  const rawBackendLocation = asset.deviceDetails.find((detail) => detail.label === "Location")?.value;
  const backendLocation = isDeviceNameLocation(rawBackendLocation, asset) ? undefined : rawBackendLocation;
  const { place, isResolving } = useReverseGeocode(asset.position, shouldResolveLocation && !backendLocation);
  const locationValue = place ?? backendLocation ?? (isResolving ? "Recherche du lieu..." : "Lieu indisponible");
  const details = [
    { label: "Location", value: locationValue },
    ...asset.deviceDetails.filter((detail) => detail.label !== "Location"),
  ];

  return (
    <div className="w-[260px] overflow-hidden rounded-[10px] text-[#0f172a]">
      <div className="flex items-start justify-between gap-3 border-b border-[#e6edf5] bg-[#f8fafc] px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold leading-tight">{asset.name}</p>
          <p className="mt-1 truncate text-[11px] font-medium text-[#64748b]">{asset.code}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: asset.color }}>{statusLabel(asset.status)}</span>
      </div>
      <div className="max-h-[180px] space-y-1 overflow-y-auto bg-white px-3 py-3 text-[11px]">
        {details.slice(0, 8).map((detail) => (
          <div key={asset.id + "-" + detail.label} className="flex items-center justify-between gap-3 rounded-[6px] bg-[#f8fafc] px-2.5 py-2">
            <span className="min-w-0 truncate font-semibold text-[#64748b]">{detailLabel(detail.label)}</span>
            <span className="max-w-[150px] truncate text-right font-bold text-[#111827]" title={detailValue(detail.label, detail.value)}>{detailValue(detail.label, detail.value)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-[#e6edf5] bg-white px-3 py-2 text-[10px] font-medium text-[#94a3b8]">
        {backendLocation ? "Lieu fourni par le serveur" : "Lieu estime depuis le GPS"}
      </div>
    </div>
  );
}

function AssetMarkers({ assets, hiddenAssetId }: { assets: LiveMapAsset[]; hiddenAssetId?: string }) {
  const map = useMap();
  const [openAssetId, setOpenAssetId] = useState<string | null>(null);

  const visibleAssets = useMemo(() => assets.filter((asset) => asset.id !== hiddenAssetId), [assets, hiddenAssetId]);

  return (
    <>
      {visibleAssets.map((asset) => (
        <Marker
          key={asset.id}
          position={asset.position!}
          icon={markerIcon(asset.color, asset.lock)}
          eventHandlers={{
            click: () => {
              setOpenAssetId(asset.id);
              map.flyTo(asset.position!, map.getMaxZoom(), {
                animate: true,
                duration: 0.9,
              });
            },
            popupclose: () => setOpenAssetId((current) => current === asset.id ? null : current),
          }}
        >
          <Popup closeButton={false} className="fleet-asset-popup">
            <AssetPopupContent asset={asset} shouldResolveLocation={openAssetId === asset.id} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

type LiveMapViewProps = {
  assets: LiveMapAsset[];
  playbackPoints: LiveMapPlaybackPoint[];
  playbackIndex: number;
  playbackAsset?: LiveMapAsset | null;
  isPlaybackOpen?: boolean;
};

export function LiveMapView({ assets, playbackPoints, playbackIndex, playbackAsset, isPlaybackOpen }: LiveMapViewProps) {
  const positionedAssets = useMemo(() => assets.filter((asset) => asset.position), [assets]);
  const tileLayer = GOOGLE_MAP_LAYER;

  return (
    <MapContainer
      center={[31.7917, -7.0926]}
      zoom={6}
      minZoom={MIN_MAP_ZOOM}
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
      <MapControls />
      {!playbackPoints.length ? <FitVisibleAssets assets={assets} /> : null}
      <AssetFocusHandler />
      <PlaybackOverlay points={playbackPoints} index={playbackIndex} playbackAsset={playbackAsset} />
      <AssetMarkers assets={isPlaybackOpen ? [] : positionedAssets} />
    </MapContainer>
  );
}
