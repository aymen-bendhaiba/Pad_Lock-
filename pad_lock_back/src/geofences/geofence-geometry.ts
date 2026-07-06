import {
  Geofence,
  GeofenceAccessMode,
  GeofenceCoordinate,
  GeofenceRules,
  GeofenceShapeType,
} from './geofence.entity';

const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_GEOFENCE_RULES: GeofenceRules = {
  smsAllowed: true,
  gprsAllowed: true,
  rfidAllowed: true,
  serialAllowed: true,
  bluetoothAllowed: true,
  lockAccessAllowed: true,
};

export function normalizeGeofenceRules(
  rules: Partial<GeofenceRules> | null | undefined,
): GeofenceRules {
  return {
    ...DEFAULT_GEOFENCE_RULES,
    ...(rules ?? {}),
  };
}

export function isPointInGeofence(
  lat: number,
  lng: number,
  geofence: Pick<Geofence, 'shapeType' | 'coordinates' | 'radiusMeters'>,
): boolean {
  if (geofence.shapeType === GeofenceShapeType.Circle) {
    const center = geofence.coordinates[0];
    return Boolean(
      center &&
      geofence.radiusMeters !== null &&
      distanceMeters({ lat, lng }, center) <= geofence.radiusMeters,
    );
  }

  if (geofence.shapeType === GeofenceShapeType.Route) {
    return (
      geofence.coordinates.length >= 2 &&
      geofence.radiusMeters !== null &&
      distanceToRouteMeters({ lat, lng }, geofence.coordinates) <=
        geofence.radiusMeters
    );
  }

  return isPointInPolygon(lat, lng, geofence.coordinates);
}

export function isLockAccessAllowedByGeofence(
  lat: number,
  lng: number,
  geofence: Pick<
    Geofence,
    'shapeType' | 'coordinates' | 'radiusMeters' | 'accessMode'
  >,
): boolean {
  const inside = isPointInGeofence(lat, lng, geofence);
  return geofence.accessMode === GeofenceAccessMode.AllowInside
    ? inside
    : !inside;
}

export function geofenceBlocksLimitedRfidAccess(
  geofence: Pick<Geofence, 'accessMode' | 'rules'>,
  inShape: boolean,
): boolean {
  const rules = normalizeGeofenceRules(geofence.rules);

  if (
    inShape &&
    (rules.lockAccessAllowed === false || rules.rfidAllowed === false)
  ) {
    return true;
  }

  return geofence.accessMode === GeofenceAccessMode.AllowOutside && inShape;
}

export function isLimitedRfidAllowedByGeofences(
  evaluatedGeofences: Array<{
    geofence: Pick<Geofence, 'accessMode' | 'rules'>;
    inShape: boolean;
  }>,
): boolean {
  if (
    evaluatedGeofences.some(({ geofence, inShape }) =>
      geofenceBlocksLimitedRfidAccess(geofence, inShape),
    )
  ) {
    return false;
  }

  const allowInsideGeofences = evaluatedGeofences.filter(
    ({ geofence }) => geofence.accessMode === GeofenceAccessMode.AllowInside,
  );

  if (allowInsideGeofences.length === 0) {
    return true;
  }

  return allowInsideGeofences.some(({ inShape }) => inShape);
}

function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: GeofenceCoordinate[],
): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;
    const intersects =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function distanceToRouteMeters(
  point: GeofenceCoordinate,
  route: GeofenceCoordinate[],
): number {
  let shortest = Number.POSITIVE_INFINITY;

  for (let i = 0; i < route.length - 1; i += 1) {
    shortest = Math.min(
      shortest,
      distanceToSegmentMeters(point, route[i], route[i + 1]),
    );
  }

  return shortest;
}

function distanceToSegmentMeters(
  point: GeofenceCoordinate,
  start: GeofenceCoordinate,
  end: GeofenceCoordinate,
): number {
  const x = lngToMeters(point.lng, point.lat);
  const y = latToMeters(point.lat);
  const x1 = lngToMeters(start.lng, point.lat);
  const y1 = latToMeters(start.lat);
  const x2 = lngToMeters(end.lng, point.lat);
  const y2 = latToMeters(end.lat);
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const t = Math.max(
    0,
    Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function distanceMeters(
  left: GeofenceCoordinate,
  right: GeofenceCoordinate,
): number {
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function latToMeters(lat: number): number {
  return toRadians(lat) * EARTH_RADIUS_METERS;
}

function lngToMeters(lng: number, atLat: number): number {
  return toRadians(lng) * EARTH_RADIUS_METERS * Math.cos(toRadians(atLat));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
