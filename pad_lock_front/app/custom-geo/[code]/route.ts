import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type CustomGeoFeature = {
  properties?: Record<string, unknown>;
  geometry?: unknown;
};

type CustomGeoCollection = {
  features?: CustomGeoFeature[];
};

let cachedCollection: { modifiedAt: number; data: CustomGeoCollection } | null = null;

async function loadCustomGeo() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "images",
    "data",
    "custom_geo.json",
  );
  const fileStat = await stat(filePath);

  if (cachedCollection?.modifiedAt === fileStat.mtimeMs) {
    return cachedCollection.data;
  }

  const data = JSON.parse(
    await readFile(filePath, "utf8"),
  ) as CustomGeoCollection;
  cachedCollection = { modifiedAt: fileStat.mtimeMs, data };
  return data;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toUpperCase();
  const collection = await loadCustomGeo();
  const feature = collection.features?.find((item) => {
    const properties = item.properties ?? {};

    return [properties.adm0_a3, properties.iso_a3, properties.sov_a3]
      .map(String)
      .some((value) => value.toUpperCase() === code);
  });

  if (!feature?.geometry) {
    return Response.json(
      { message: "Custom country geometry not found" },
      { status: 404 },
    );
  }

  return Response.json(
    { countryCode: code, geometry: feature.geometry },
    { headers: { "Cache-Control": "no-store" } },
  );
}