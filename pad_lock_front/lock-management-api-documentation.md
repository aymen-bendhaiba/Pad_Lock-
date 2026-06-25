**Lock Management API Documentation** 

## **Lock Management API** 

Smart lock API reference, setup guide, geofence behavior, RFID sync, dashboard summary, and operational notes. 

Secure NestJS API baseline for a smart lock management platform with authentication, lock records, RFID card commands, alert storage, and JT701D TCP ingestion. 

## **Stack** 

- NestJS 11 

- PostgreSQL with PostGIS ready for later lock location/device data 

- TypeORM 

- JWT authentication with Passport 

- bcrypt password hashing 

- Helmet, CORS, validation pipes, and request throttling 

- JT701D TCP listener for lock messages and RFID command responses 

## **Local Setup** 

```
npm install
npm run start:dev
```

Create a `.env` file before starting. For Neon, use the connection string directly: 

```
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3001,http://localhost:3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
DB_SSL=true
DB_SYNCHRONIZE=true
JWT_SECRET=your-long-random-secret-at-least-32-characters
JWT_EXPIRES_IN=15m
TCP_HOST=0.0.0.0
TCP_PORT=8989
TCP_COMMAND_TIMEOUT_MS=60000
RETENTION_ENABLED=true
DATA_RETENTION_DAYS=30
RETENTION_ARCHIVE_BATCH_SIZE=1000
ARCHIVE_DATABASE_URL=postgresql://USER:PASSWORD@ARCHIVE_HOST.neon.tech/
ARCHIVE_DB?sslmode=require
ARCHIVE_DB_SSL=true
```

Set `DB_SYNCHRONIZE=true` only for first local prototyping/table creation. Keep it `false` after the schema exists and for shared/staging/production databases. If using Neon, run this once in the Neon SQL Editor: 

```
CREATE EXTENSION IF NOT EXISTS postgis;
```

Retention and archive behavior: 

Page 1 

**Lock Management API Documentation** 

- The live database keeps high-volume operational data for `DATA_RETENTION_DAYS` days. Default: `30` . 

- The daily retention job runs at `02:15 UTC` . 

- It archives the oldest expired day first, then soft-deletes those live rows with `deletedAt` . 

- Example: with 30 days retention, when July 1 is reached, June 1 becomes eligible. The next day, June 2 becomes eligible, and so on. 

- Archived rows are copied into the separate database from `ARCHIVE_DATABASE_URL` before soft delete. 

- The archive database stores full original rows as JSON in `archived_records` , with `source_table` , `source_id` , `terminal_id` , `data_timestamp` , and `archived_at` . 

- Currently archived high-volume tables: `lock_events` and `lock_positions` . 

- Set `DATA_RETENTION_DAYS` per client contract, for example `30` , `60` , or `90` . 

## **API** 

All routes are prefixed with `/api` . 

Public routes: 

- `GET /api` 

- `POST /api/auth/register` 

- `POST /api/auth/login` 

Protected lock-management routes require `Authorization: Bearer <accessToken>` : 

- `GET /api/locks` 

- `POST /api/locks` 

- `GET /api/locks/:terminalId` 

- `PATCH /api/locks/:terminalId` 

- `GET /api/locks/:terminalId/rfid-cards` 

- `POST /api/locks/:terminalId/rfid-cards` 

- `PUT /api/locks/:terminalId/rfid-cards/:cardNumber/role` 

- `DELETE /api/locks/:terminalId/rfid-cards` 

- `DELETE /api/locks/:terminalId/rfid-cards/all` 

- `GET /api/locks/:terminalId/rfid-cards/groups/:group` 

- `GET /api/alerts` 

- `GET /api/locks/:terminalId/events` 

- `POST /api/locks/:terminalId/events` 

- `GET /api/devices` 

- `GET /api/history/:terminalId` 

- `GET /api/dashboard/summary` 

- `GET /api/geo-boundaries` 

- `GET /api/geo-boundaries/:id` 

Page 2 

**Lock Management API Documentation** 

- `POST /api/unlock` 

- `POST /api/clearcache` 

- `POST /api/restart` 

- `POST /api/battery/threshold/set` 

- `GET /api/battery/threshold/query/:terminalId` 

- `POST /api/password/modify` 

- `GET /api/password/query/:terminalId` 

- `POST /api/deepsleep/set` 

- `GET /api/deepsleep/query/:terminalId` 

- `POST /api/vip/phone/set` 

- `GET /api/vip/phone/query/:terminalId/:index` 

- `POST /api/vip/sms/set` 

- `GET /api/vip/sms/query/:terminalId` 

- `GET /api/geofences` 

- `POST /api/geofences` 

- `POST /api/geofences/from-boundary` 

- `DELETE /api/geofences/:id` 

- `POST /api/locks/:terminalId/access/check` 

- `GET /api/geofence/device/query/:terminalId` 

- `POST /api/geofence/device/set` 

RFID card commands follow JT701D `P41` : 

• Add cards: `(P41,1,1,count,cards...)` 

- Delete cards: `(P41,1,2,count,cards...)` 

- Clear cards: `(P41,1,3)` 

- Query group: `(P41,0,group)` 

Querying an RFID group also syncs returned cards into the local database, so cards added directly on the physical lock can appear in the API. 

## Dashboard summary: 

- `GET /api/dashboard/summary` returns KPI cards and chart-ready data for the dashboard. 

- Optional query params: `from` and `to` as ISO date strings. 

- The response includes `kpis` , `connectionStatus` , `lockActivity` , `topAlarms` , `lockStateDistribution` , and `rfidSyncStatus` . 

## Example: 

```
GET /api/dashboard/summary?from=2026-06-01T00:00:00.000Z&to=2026-06-22T23:59:59.999Z
```

## RFID card roles: 

Page 3 

**Lock Management API Documentation** 

- `admin` : one admin card per lock, allowed anywhere. 

- `limited` : up to 19 limited cards per lock, checked against active geofence rules. 

- `POST /api/locks/:terminalId/rfid-cards` defaults to `limited` when `role` is omitted. 

- Include `role: "admin"` only when intentionally assigning the one admin card. 

- Use `PUT /api/locks/:terminalId/rfid-cards/:cardNumber/role` to promote or demote a card. 

- Card responses include physical sync state: `installedOnLock` , `lastSyncStatus` , `lastSyncError` , and `lastSyncedAt` . 

- Physical geofence enforcement uses JT701D `P41` : blocked limited cards are temporarily removed from the lock whitelist, then restored when allowed again. 

- Admin cards are never removed by geofence automation. 

Geo boundary catalog: 

- Use `geo_boundaries` for reference map data such as country polygons. 

- Use `geofences` for real business rules such as whether a lock can open inside/outside a boundary. 

- `GET /api/geo-boundaries` searches imported boundaries without returning the heavy geometry. 

- `GET /api/geo-boundaries/:id` returns one boundary with GeoJSON geometry for map drawing. 

- `POST /api/geofences/from-boundary` creates a real geofence rule linked to a selected boundary. 

- Boundary-linked geofences use PostGIS point-in-polygon checks. 

Geo boundary search filters: 

- `type` : `continent` , `country` , `region` , or `city` . 

- `search` : partial boundary name match, for example `morocco` or `costa` . 

- `countryCode` : exact ISO country code match, for example `MAR` or `CRI` . 

- `continent` : exact case-insensitive continent name match, for example `Africa` . 

- `limit` : number of records to return, from `1` to `100` ; defaults to `50` . 

Import the provided country GeoJSON file: 

```
npm run geo:import
```

Or import another GeoJSON FeatureCollection: 

```
npm run geo:import -- "C:\path\to\boundaries.geojson"
```

If `DB_SYNCHRONIZE=false` , the import script still creates the `geo_boundaries` table and PostGIS indexes. For `geofences` , add the optional link column manually: 

```
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS "geoBoundaryId" uuid;
```

For better database performance on Neon/production, run the SQL in `database/performance-indexes.sql` . It adds indexes for latest lock positions, event history, retention cleanup, RFID card lookups, geofence ordering, and PostGIS boundary checks. 

For physical RFID geofence enforcement, run `database/rfid-sync-state.sql` before the performance indexes if `DB_SYNCHRONIZE=false` . 

Page 4 

**Lock Management API Documentation** 

## Example boundary search: 

```
GET /api/geo-boundaries?type=country&search=costa&limit=10
GET /api/geo-boundaries?type=country&continent=Africa&limit=100
GET /api/geo-boundaries?type=country&countryCode=MAR
```

Example geofence from imported country boundary: 

```
{
  "name": "Costa Rica country rule",
  "geoBoundaryId": "boundary-uuid-here",
  "accessMode": "allow_inside",
  "rules": {
    "smsAllowed": true,
    "gprsAllowed": true,
    "rfidAllowed": true,
    "serialAllowed": true,
    "bluetoothAllowed": true,
    "lockAccessAllowed": true
  }
}
```

Geofences can describe three shapes: 

- `polygon` : a closed area. Send at least 3 coordinate points. 

- `circle` : a center point plus `radiusMeters` . 

- `route` : a line/way corridor. Send at least 2 coordinate points plus `radiusMeters` for the corridor width. 

Geofence access is controlled by `accessMode` : 

• `allow_inside` : limited cards may unlock only when the lock is inside the geofence shape. 

- `allow_outside` : limited cards may unlock only when the lock is outside the geofence shape. 

Geofence rules include `lockAccessAllowed` . The frontend checkbox should write this boolean to `rules.lockAccessAllowed` . For limited cards, access is blocked when the `accessMode` rule does not match the lock position, or when `rules.lockAccessAllowed` or `rules.rfidAllowed` is `false` in a geofence that currently contains the lock. Admin cards bypass these backend restrictions. 

## Physical RFID swipe enforcement: 

- The API database keeps every card and role as the source of truth. 

- When a lock reports GPS, the backend evaluates geofences for limited cards. 

- If limited cards are blocked and installed on the lock, the backend sends `P41 delete` for those cards only. 

- If limited cards become allowed again and are not installed on the lock, the backend sends `P41 add` . 

- Failed/offline syncs are kept as `pending_add` , `pending_delete` , or `failed` and retried on later GPS reports. 

- `P59 rfid=false` is not used for per-card blocking because it disables RFID for admin cards too. 

## Example polygon geofence: 

```
{
  "name": "Warehouse yard",
  "shapeType": "polygon",
```

- `"accessMode": "allow_inside",` 

- `"coordinates": [` 

- `{ "lat": 33.594, "lng": -7.62 },` 

- `{ "lat": 33.596, "lng": -7.62 },` 

- `{ "lat": 33.596, "lng": -7.617 }` 

Page 5 

**Lock Management API Documentation** 

```
  ],
  "rules": {
    "smsAllowed": true,
    "gprsAllowed": true,
    "rfidAllowed": true,
    "serialAllowed": true,
    "bluetoothAllowed": true,
    "lockAccessAllowed": true
  }
}
```

## Example circle geofence: 

```
{
  "name": "Depot radius",
  "shapeType": "circle",
  "accessMode": "allow_inside",
  "coordinates": [{ "lat": 33.594, "lng": -7.62 }],
  "radiusMeters": 250,
  "rules": {
    "smsAllowed": true,
    "gprsAllowed": true,
    "rfidAllowed": true,
    "serialAllowed": true,
    "bluetoothAllowed": true,
    "lockAccessAllowed": true
  }
}
```

Example route geofence: 

```
{
  "name": "Approved route",
  "shapeType": "route",
  "accessMode": "allow_outside",
  "coordinates": [
    { "lat": 33.594, "lng": -7.62 },
    { "lat": 33.6, "lng": -7.61 }
  ],
  "radiusMeters": 100,
  "rules": {
    "smsAllowed": true,
    "gprsAllowed": true,
    "rfidAllowed": true,
    "serialAllowed": true,
    "bluetoothAllowed": true,
    "lockAccessAllowed": true
  }
}
```

The app also starts a TCP listener on `TCP_HOST:TCP_PORT` ( `0.0.0.0:8989` by default), matching the reference prototype. RFID card routes send the P41 command to the connected lock and wait up to `TCP_COMMAND_TIMEOUT_MS` for the P41 response. 

## Incoming JT701D TCP handling: 

- Binary `$` frames are buffered, parsed, ACKed with `P69` , and alarm bits are stored as lock events. 

- ASCII `P45` lock/unlock reports are parsed, ACKed with `P69` , and stored as lock events. 

- ASCII `P22` time sync requests are answered. 

- ASCII `P41` , `P43` , `P59` , `P61` , `P44` , `P03` , `P11` , `P12` , and `P15` responses resolve pending API requests. 

- GPS reports are checked against saved geofences. Active overlapping geofence rules are merged with the most restrictive permissions and sent to the lock with `P59` when channel settings change. 

Page 6 

**Lock Management API Documentation** 

## Create a lock record before expecting events to persist: 

```
{
  "terminalId": "8034400004",
  "name": "Main lock"
}
```

## **Verification** 

```
npm run lint
npm run build
npm test
```

Page 7 

