# Lock Management API

Secure NestJS API baseline for a smart lock management platform with authentication, lock records, RFID card commands, alert storage, and JT701D TCP ingestion.

## Stack

- NestJS 11
- PostgreSQL with PostGIS ready for later lock location/device data
- TypeORM
- JWT authentication with Passport
- bcrypt password hashing
- Helmet, CORS, validation pipes, and request throttling
- JT701D TCP listener for lock messages and RFID command responses

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run start:dev
```

Set `DB_SYNCHRONIZE=true` only for quick local prototyping. Keep it `false` for shared, staging, and production databases.

## API

All routes are prefixed with `/api`.

Public routes:

- `GET /api`
- `POST /api/auth/register`
- `POST /api/auth/login`

Protected lock-management routes require `Authorization: Bearer <accessToken>`:

- `GET /api/locks`
- `POST /api/locks`
- `GET /api/locks/:terminalId`
- `PATCH /api/locks/:terminalId`
- `GET /api/locks/:terminalId/rfid-cards`
- `POST /api/locks/:terminalId/rfid-cards`
- `DELETE /api/locks/:terminalId/rfid-cards`
- `DELETE /api/locks/:terminalId/rfid-cards/all`
- `GET /api/locks/:terminalId/rfid-cards/groups/:group`
- `GET /api/alerts`
- `GET /api/locks/:terminalId/events`
- `POST /api/locks/:terminalId/events`
- `GET /api/devices`
- `GET /api/history/:terminalId`
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
- `DELETE /api/geofences/:id`
- `GET /api/geofence/device/query/:terminalId`
- `POST /api/geofence/device/set`

RFID card commands follow JT701D `P41`:

- Add cards: `(P41,1,1,count,cards...)`
- Delete cards: `(P41,1,2,count,cards...)`
- Clear cards: `(P41,1,3)`
- Query group: `(P41,0,group)`

The app also starts a TCP listener on `TCP_HOST:TCP_PORT` (`0.0.0.0:8989` by default), matching the reference prototype. RFID card routes send the P41 command to the connected lock and wait up to `TCP_COMMAND_TIMEOUT_MS` for the P41 response.

Incoming JT701D TCP handling:

- Binary `$` frames are buffered, parsed, ACKed with `P69`, and alarm bits are stored as lock events.
- ASCII `P45` lock/unlock reports are parsed, ACKed with `P69`, and stored as lock events.
- ASCII `P22` time sync requests are answered.
- ASCII `P41`, `P43`, `P59`, `P61`, `P44`, `P03`, `P11`, `P12`, and `P15` responses resolve pending API requests.
- GPS reports are checked against saved geofences. Active overlapping geofence rules are merged with the most restrictive permissions and sent to the lock with `P59` when channel settings change.

Create a lock record before expecting events to persist:

```json
{
  "terminalId": "8034400004",
  "name": "Main lock"
}
```

## Verification

```bash
npm run lint
npm run build
npm test
```
