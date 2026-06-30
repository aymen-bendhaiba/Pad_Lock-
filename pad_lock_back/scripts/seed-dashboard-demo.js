const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const demoTerminalIds = [
  'DEMOLOCK001',
  'DEMOLOCK002',
  'DEMOLOCK003',
  'DEMOLOCK004',
  'DEMOLOCK005',
  'DEMOLOCK006',
  'DEMOLOCK007',
  'DEMOLOCK008',
];

const sites = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Casablanca',
    lat: 33.5731,
    lng: -7.5898,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Rabat',
    lat: 34.0209,
    lng: -6.8416,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Marrakech',
    lat: 31.6295,
    lng: -7.9811,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Tanger',
    lat: 35.7595,
    lng: -5.834,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Fes',
    lat: 34.0181,
    lng: -5.0078,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Agadir',
    lat: 30.4278,
    lng: -9.5981,
  },
];

const rfidCards = [
  { number: '0006950824', label: 'Admin card', role: 'admin' },
  { number: '0006950536', label: 'Operator A', role: 'limited' },
  { number: '0007692522', label: 'Operator B', role: 'limited' },
  { number: '1234567890', label: 'Maintenance', role: 'limited' },
  { number: '0007774321', label: 'Night shift', role: 'limited' },
  { number: '0008882905', label: 'Supervisor', role: 'limited' },
];

const alertTypes = [
  'low_battery',
  'vibration',
  'illegal_rfid',
  'wrong_password',
  'lock_rope_cut',
  'back_cover_opened',
  'long_unlock',
];

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const pattern = /^([A-Z0-9_]+)=("([\s\S]*?)"|[^\r\n]*)/gm;

  for (const match of content.matchAll(pattern)) {
    const key = match[1];
    const rawValue = match[3] ?? match[2] ?? '';

    process.env[key] ??= rawValue.replace(/^"|"$/g, '').replace(/\r?\n/g, '');
  }
}

function connectionOptions() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'lock_api',
    password: process.env.DB_PASSWORD ?? 'lock_api_password',
    database: process.env.DB_NAME ?? 'lock_management',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}

function daysAgo(days, hour = 10, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function severityFor(type) {
  if (['lock_rope_cut', 'illegal_rfid', 'wrong_password'].includes(type)) {
    return 'critical';
  }

  if (
    ['low_battery', 'long_unlock', 'back_cover_opened', 'vibration'].includes(
      type,
    )
  ) {
    return 'warning';
  }

  return 'info';
}

function jitter(value, index) {
  return value + ((index % 7) - 3) * 0.006;
}

async function insertRows(pool, insertSql, rows, placeholderFor) {
  if (rows.length === 0) {
    return;
  }

  const values = [];
  let index = 0;
  const placeholders = rows
    .map((row) => {
      const rowPlaceholders = row.map((value, columnIndex) => {
        values.push(value);
        index += 1;
        return placeholderFor
          ? placeholderFor(index, columnIndex)
          : `$${index}`;
      });

      return `(${rowPlaceholders.join(', ')})`;
    })
    .join(',\n');

  await pool.query(`${insertSql}\nVALUES ${placeholders}`, values);
}

async function clearDemoData(pool) {
  await pool.query(
    `DELETE FROM geofence_transitions WHERE "terminalId" = ANY($1)`,
    [demoTerminalIds],
  );
  await pool.query(`DELETE FROM lock_events WHERE "terminalId" = ANY($1)`, [
    demoTerminalIds,
  ]);
  await pool.query(`DELETE FROM lock_positions WHERE "terminalId" = ANY($1)`, [
    demoTerminalIds,
  ]);
  await pool.query(
    `DELETE FROM rfid_cards WHERE "lockDeviceId" IN (
       SELECT id FROM lock_devices WHERE "terminalId" = ANY($1)
     )`,
    [demoTerminalIds],
  );
  await pool.query(`DELETE FROM lock_devices WHERE "terminalId" = ANY($1)`, [
    demoTerminalIds,
  ]);
  await pool.query(`DELETE FROM geofences WHERE name LIKE 'Demo %'`);
}

async function seedLocks(pool) {
  const rows = [];

  for (const [index, terminalId] of demoTerminalIds.entries()) {
    const status = index < 6 ? 'online' : index === 6 ? 'offline' : 'unknown';
    const result = await pool.query(
      `
        INSERT INTO lock_devices (id, "terminalId", name, imei, status, "lastSeenAt", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, "terminalId"
      `,
      [
        randomUUID(),
        terminalId,
        `Demo Lock ${index + 1}`,
        `8693000000000${index + 1}`,
        status,
        status === 'online' ? new Date() : daysAgo(index + 1),
      ],
    );
    rows.push(result.rows[0]);
  }

  return rows;
}

async function seedGeofences(pool) {
  const rules = {
    smsAllowed: true,
    gprsAllowed: true,
    rfidAllowed: true,
    serialAllowed: true,
    bluetoothAllowed: true,
    lockAccessAllowed: true,
  };

  for (const site of sites) {
    await pool.query(
      `
        INSERT INTO geofences (
          id, name, "terminalIds", "geoBoundaryId", "shapeType", coordinates,
          "radiusMeters", "applyInside", "accessMode", rules, "createdAt"
        )
        VALUES ($1, $2, $3, NULL, 'circle', $4::jsonb, 25000, true, 'allow_inside', $5::jsonb, NOW())
      `,
      [
        site.id,
        `Demo ${site.name}`,
        demoTerminalIds,
        JSON.stringify([{ lat: site.lat, lng: site.lng }]),
        JSON.stringify(rules),
      ],
    );
  }
}

async function seedRfidCards(pool, locks) {
  for (const lock of locks) {
    for (const [index, card] of rfidCards.entries()) {
      await pool.query(
        `
          INSERT INTO rfid_cards (
            id, "lockDeviceId", "cardNumber", label, role, active,
            "installedOnLock", "lastSyncStatus", "lastSyncError", "lastSyncedAt",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, true, $6, 'synced', NULL, NOW(), NOW(), NOW())
        `,
        [randomUUID(), lock.id, card.number, card.label, card.role, index < 4],
      );
    }
  }
}

async function seedPositions(pool, locks) {
  const rows = [];

  for (const [lockIndex, lock] of locks.entries()) {
    for (let day = 29; day >= 0; day -= 1) {
      const site = sites[(day + lockIndex) % sites.length];
      const samples = day < 7 ? 4 : 2;

      for (let sample = 0; sample < samples; sample += 1) {
        const moving = (sample + day + lockIndex) % 3 !== 0;
        const recordedAt = daysAgo(day, 8 + sample * 3, (lockIndex * 7) % 60);

        rows.push([
          randomUUID(),
          lock.id,
          lock.terminalId,
          jitter(site.lat, sample + lockIndex),
          jitter(site.lng, day + sample),
          moving ? 18 + ((day + sample) % 42) : 0,
          (day * 23 + sample * 41) % 360,
          Math.max(8, 96 - day - lockIndex * 3),
          sample === 0 && lockIndex % 4 === 0,
          (day + sample + lockIndex) % 2 === 0,
          true,
          1000 + lockIndex * 320 + day * 14 + sample * 3,
          JSON.stringify({ demoSeed: true }),
          recordedAt,
          recordedAt,
          null,
        ]);
      }
    }
  }

  await insertRows(
    pool,
    `
      INSERT INTO lock_positions (
        id, "lockDeviceId", "terminalId", latitude, longitude, "speedKmh",
        "directionDegrees", "batteryPercentage", "isCharging", "isLocked",
        "isPositioned", mileage, "rawPayload", "recordedAt", "receivedAt", "deletedAt"
      )
    `,
    rows,
    (index, columnIndex) => {
      if (columnIndex === 12) {
        return `$${index}::jsonb`;
      }

      return `$${index}`;
    },
  );
}

async function seedEvents(pool, locks) {
  const rows = [];

  for (const [lockIndex, lock] of locks.entries()) {
    for (let day = 29; day >= 0; day -= 1) {
      const site = sites[(day + lockIndex) % sites.length];
      const baseTime = daysAgo(day, 9 + (lockIndex % 5), (day * 3) % 60);
      const geofences = [{ id: site.id, name: `Demo ${site.name}` }];
      const card = rfidCards[(day + lockIndex) % rfidCards.length];
      const lockEventType = (day + lockIndex) % 2 === 0 ? 'locked' : 'unlocked';

      rows.push(
        eventRow(lock, {
          type: lockEventType,
          severity: 'info',
          source:
            lockEventType === 'unlocked'
              ? 'Swipe RFID card'
              : 'Automatically locked',
          rfidCardNumber: lockEventType === 'unlocked' ? card.number : null,
          latitude: jitter(site.lat, lockIndex),
          longitude: jitter(site.lng, day),
          geofences,
          occurredAt: baseTime,
        }),
      );

      if ((day + lockIndex) % 3 === 0) {
        const type = alertTypes[(day + lockIndex) % alertTypes.length];
        rows.push(
          eventRow(lock, {
            type,
            severity: severityFor(type),
            source: `Demo ${type.replaceAll('_', ' ')}`,
            rfidCardNumber:
              type === 'illegal_rfid' || type === 'wrong_password'
                ? card.number
                : null,
            latitude: jitter(site.lat, lockIndex + 2),
            longitude: jitter(site.lng, day + 2),
            geofences,
            occurredAt: new Date(baseTime.getTime() + 45 * 60 * 1000),
          }),
        );
      }
    }
  }

  await insertRows(
    pool,
    `
      INSERT INTO lock_events (
        id, "lockDeviceId", "terminalId", type, severity, status, source,
        "rfidCardNumber", latitude, longitude, "rawPayload", geofences,
        "occurredAt", "receivedAt", "deletedAt"
      )
    `,
    rows,
    (index, columnIndex) => {
      if (columnIndex === 10 || columnIndex === 11) {
        return `$${index}::jsonb`;
      }

      return `$${index}`;
    },
  );
}

function eventRow(lock, event) {
  return [
    randomUUID(),
    lock.id,
    lock.terminalId,
    event.type,
    event.severity,
    'unread',
    event.source,
    event.rfidCardNumber,
    event.latitude,
    event.longitude,
    JSON.stringify({ demoSeed: true }),
    JSON.stringify(event.geofences),
    event.occurredAt,
    event.occurredAt,
    null,
  ];
}

async function main() {
  loadEnv();

  const pool = new Pool(connectionOptions());

  try {
    await clearDemoData(pool);
    const locks = await seedLocks(pool);
    await seedGeofences(pool);
    await seedRfidCards(pool, locks);
    await seedPositions(pool, locks);
    await seedEvents(pool, locks);

    console.log(
      `Seeded dashboard demo data for ${locks.length} locks over the last 30 days.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
