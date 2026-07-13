import type { LatLngTuple, ShapeType } from "./geofence-types";

const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function normalizedLongitudeDelta(delta: number) {
  if (delta > Math.PI) return delta - 2 * Math.PI;
  if (delta < -Math.PI) return delta + 2 * Math.PI;
  return delta;
}

export function lineLengthMeters(points: LatLngTuple[]) {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const [startLat, startLng] = points[index - 1];
    const [endLat, endLng] = points[index];
    const latitudeDelta = toRadians(endLat - startLat);
    const longitudeDelta = toRadians(endLng - startLng);
    const startLatitude = toRadians(startLat);
    const endLatitude = toRadians(endLat);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

    total += 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  return total;
}

export function polygonAreaSquareMeters(points: LatLngTuple[]) {
  if (points.length < 3) return 0;

  let sphericalExcess = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [startLat, startLng] = points[index];
    const [endLat, endLng] = points[(index + 1) % points.length];
    const longitudeDelta = normalizedLongitudeDelta(toRadians(endLng - startLng));

    sphericalExcess += longitudeDelta
      * (2 + Math.sin(toRadians(startLat)) + Math.sin(toRadians(endLat)));
  }

  return Math.abs(sphericalExcess) * EARTH_RADIUS_METERS ** 2 / 2;
}

function formatNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDistanceMeters(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return "0 m";
  if (distanceMeters < 1_000) return formatNumber(distanceMeters, distanceMeters < 10 ? 1 : 0) + " m";

  const kilometers = distanceMeters / 1_000;
  return formatNumber(kilometers, kilometers < 10 ? 2 : 1) + " km";
}

export function formatAreaSquareMeters(areaSquareMeters: number) {
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0) return "0 m\u00B2";
  if (areaSquareMeters < 1_000_000) {
    return formatNumber(areaSquareMeters, areaSquareMeters < 10 ? 1 : 0) + " m\u00B2";
  }

  const squareKilometers = areaSquareMeters / 1_000_000;
  return formatNumber(squareKilometers, squareKilometers < 10 ? 2 : 1) + " km\u00B2";
}

export function formatGeofenceMeasurement(
  shapeType: ShapeType | null,
  points: LatLngTuple[],
  radiusMeters: number,
) {
  if (shapeType === "route") {
    return formatDistanceMeters(lineLengthMeters(points));
  }

  if (shapeType === "polygon") {
    return formatAreaSquareMeters(polygonAreaSquareMeters(points));
  }

  if (shapeType === "circle") {
    return points.length
      ? formatAreaSquareMeters(Math.PI * radiusMeters ** 2)
      : "0 m\u00B2";
  }

  return "--";
}