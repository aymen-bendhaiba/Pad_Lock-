const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const defaultGeoJsonPath = 'C:\\Users\\pc\\Downloads\\custom.geo (1) 1.json';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...rest] = trimmed.split('=');
    process.env[key] ??= rest.join('=').replace(/^"|"$/g, '');
  }
}

function boundaryType(feature) {
  const featureClass = String(feature.properties?.featurecla ?? '');

  if (featureClass.includes('Admin-0')) {
    return 'country';
  }

  if (feature.properties?.continent && !feature.properties?.admin) {
    return 'continent';
  }

  if (feature.properties?.city || feature.properties?.nameascii) {
    return 'city';
  }

  return 'region';
}

function boundaryName(feature) {
  return (
    feature.properties?.name_en ??
    feature.properties?.name ??
    feature.properties?.admin ??
    feature.properties?.name_long ??
    'Unnamed boundary'
  );
}

function countryCode(feature) {
  const value =
    feature.properties?.iso_a3 ??
    feature.properties?.adm0_a3 ??
    feature.properties?.sov_a3;

  return typeof value === 'string' && value.length === 3 ? value : null;
}

function bboxOfGeometry(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];

  function visit(value) {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      bbox[0] = Math.min(bbox[0], value[0]);
      bbox[1] = Math.min(bbox[1], value[1]);
      bbox[2] = Math.max(bbox[2], value[0]);
      bbox[3] = Math.max(bbox[3], value[1]);
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
    }
  }

  visit(geometry.coordinates);
  return bbox.every(Number.isFinite) ? bbox : [];
}

async function ensureSchema(pool) {
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS geo_boundaries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type varchar(40) NOT NULL,
      name varchar(160) NOT NULL,
      "countryCode" varchar(3),
      continent varchar(160),
      bbox jsonb NOT NULL DEFAULT '[]'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      geometry geometry(Geometry, 4326) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS geo_boundaries_type_name_idx
    ON geo_boundaries (type, name)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS geo_boundaries_geometry_gist_idx
    ON geo_boundaries USING GIST (geometry)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS geo_boundaries_name_idx
    ON geo_boundaries (name)
  `);
}

async function main() {
  loadEnv();
  const filePath = process.argv[2] ?? defaultGeoJsonPath;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in .env or process env');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const geojson = JSON.parse(raw);

  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Expected a GeoJSON FeatureCollection');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.DB_SSL === 'true' || databaseUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
  });

  await ensureSchema(pool);

  let imported = 0;

  for (const feature of geojson.features) {
    if (!feature.geometry) {
      continue;
    }

    const type = boundaryType(feature);
    const name = boundaryName(feature);
    const code = countryCode(feature);
    const continent = feature.properties?.continent ?? null;
    const bbox = bboxOfGeometry(feature.geometry);

    await pool.query(
      `
        INSERT INTO geo_boundaries (
          type,
          name,
          "countryCode",
          continent,
          bbox,
          metadata,
          geometry
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6::jsonb,
          ST_SetSRID(ST_MakeValid(ST_GeomFromGeoJSON($7)), 4326)
        )
        ON CONFLICT (type, name)
        DO UPDATE SET
          continent = EXCLUDED.continent,
          bbox = EXCLUDED.bbox,
          metadata = EXCLUDED.metadata,
          geometry = EXCLUDED.geometry,
          "updatedAt" = now()
      `,
      [
        type,
        name,
        code,
        continent,
        JSON.stringify(bbox),
        JSON.stringify(feature.properties ?? {}),
        JSON.stringify(feature.geometry),
      ],
    );
    imported += 1;
  }

  await pool.end();
  console.log(`Imported ${imported} geo boundaries from ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
