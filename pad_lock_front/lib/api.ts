export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

const AUTH_TOKEN_KEY = "pad_lock_access_token";
const AUTH_USER_KEY = "pad_lock_auth_user";
const API_CACHE_PREFIX = "pad_lock_api_cache:";
const TOKEN_FALLBACK_TTL_MS = 15 * 60 * 1000;
const inFlightJsonRequests = new Map<string, Promise<unknown>>();

type LoginResponse = {
  accessToken?: string;
  token?: string;
  user?: unknown;
};

export type StoredUserProfile = {
  name: string;
  email: string;
  initials: string;
};

export type GeoBoundaryType = "continent" | "country" | "region" | "city";

export type GeoBoundaryQuery = {
  type?: GeoBoundaryType;
  search?: string;
  countryCode?: string;
  continent?: string;
  limit?: number;
};

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

function getTokenSignature(token: string | null) {
  if (!token) {
    return "anonymous";
  }

  return `${token.slice(0, 12)}:${token.slice(-12)}`;
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(padded)) as Record<string, unknown> & { exp?: number };
  } catch {
    return null;
  }
}

export function getAccessTokenExpiryMs(token = getStoredAccessToken()) {
  if (!token || typeof window === "undefined") {
    return Date.now();
  }

  const payload = decodeJwtPayload(token);

  if (payload?.exp) {
    return payload.exp * 1000;
  }

  return Date.now() + TOKEN_FALLBACK_TTL_MS;
}

function getCacheStorageKey(path: string) {
  return `${API_CACHE_PREFIX}${path}`;
}

function isCacheEntryFresh(entry: { expiresAt: number; tokenSignature: string }) {
  const token = getStoredAccessToken();

  return (
    entry.expiresAt > Date.now() &&
    entry.tokenSignature === getTokenSignature(token)
  );
}

export function clearAppCache() {
  if (typeof window === "undefined") {
    return;
  }

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(API_CACHE_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function textFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function initialsFromName(name: string, email: string) {
  const source = name && name !== email ? name : email.split("@")[0] ?? "User";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");

  return initials || "U";
}

function normalizeUserProfile(user: unknown, emailFallback?: string): StoredUserProfile | null {
  const record = user && typeof user === "object" ? user as Record<string, unknown> : null;
  const firstName = textFromRecord(record, ["firstName", "firstname", "given_name", "givenName"]);
  const lastName = textFromRecord(record, ["lastName", "lastname", "family_name", "familyName"]);
  const fullName = textFromRecord(record, ["name", "fullName", "username", "displayName"])
    ?? [firstName, lastName].filter(Boolean).join(" ");
  const email = textFromRecord(record, ["email", "mail", "userEmail"])
    ?? emailFallback
    ?? "user@harmony.ma";
  const name = fullName || email;

  return {
    name,
    email,
    initials: initialsFromName(name, email),
  };
}

export function getStoredUserProfile(): StoredUserProfile {
  if (typeof window === "undefined") {
    return { name: "User", email: "user@harmony.ma", initials: "U" };
  }

  const storedUser = window.localStorage.getItem(AUTH_USER_KEY);

  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser) as StoredUserProfile;

      if (parsed.name && parsed.email && parsed.initials) {
        return parsed;
      }
    } catch {
      window.localStorage.removeItem(AUTH_USER_KEY);
    }
  }

  const token = getStoredAccessToken();
  const tokenProfile = token ? normalizeUserProfile(decodeJwtPayload(token)) : null;

  return tokenProfile ?? { name: "User", email: "user@harmony.ma", initials: "U" };
}

export function buildAlertStreamUrl(terminalId?: string) {
  const params = new URLSearchParams();

  if (terminalId) {
    params.set("terminalId", terminalId);
  }

  const query = params.toString();

  return `${buildApiUrl("/alerts/stream")}${query ? `?${query}` : ""}`;
}

export function storeAccessToken(token: string, user?: unknown, emailFallback?: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);

  const profile = normalizeUserProfile(user ?? decodeJwtPayload(token), emailFallback);

  if (profile) {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("pad-lock:user-updated"));
  }

  window.dispatchEvent(new CustomEvent("pad-lock:token-stored"));
}

export function clearAccessToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  clearAppCache();
}

export async function loginWithCredentials(email: string, password: string) {
  const response = await fetch(buildApiUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json().catch(() => null)) as
    | LoginResponse
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && "message" in payload && payload.message
        ? payload.message
        : "Connexion refusee. Verifiez votre email et votre mot de passe.";

    throw new Error(message);
  }

  const accessToken =
    payload && "accessToken" in payload
      ? payload.accessToken
      : payload && "token" in payload
        ? payload.token
        : undefined;

  if (!accessToken) {
    throw new Error("Connexion impossible. Le serveur n'a pas retourne de session valide.");
  }

  storeAccessToken(accessToken, payload && "user" in payload ? payload.user : undefined, email);

  return payload;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getStoredAccessToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers,
  });
}

export async function cachedApiJson<T = unknown>(path: string, force = false) {
  if (typeof window === "undefined") {
    const response = await apiFetch(path, force ? { cache: "no-store" } : {});
    return (await response.json()) as T;
  }

  const storageKey = getCacheStorageKey(path);
  const cached = window.localStorage.getItem(storageKey);
  let cachedEntry:
    | {
        data: T;
        expiresAt: number;
        tokenSignature: string;
      }
    | null = null;

  if (cached) {
    try {
      cachedEntry = JSON.parse(cached) as {
        data: T;
        expiresAt: number;
        tokenSignature: string;
      };

      if (!force && isCacheEntryFresh(cachedEntry)) {
        return cachedEntry.data;
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }

  const token = getStoredAccessToken();
  const requestKey = `${path}:${force ? "force" : "cache"}:${getTokenSignature(token)}`;
  const inFlight = inFlightJsonRequests.get(requestKey);

  if (inFlight) {
    return (await inFlight) as T;
  }

  const request = (async () => {
    const response = await apiFetch(path, force ? { cache: "no-store" } : {});

    if (response.status === 304 && cachedEntry && isCacheEntryFresh(cachedEntry)) {
      return cachedEntry.data;
    }

    if (!response.ok) {
      throw new Error("Le service est momentanement indisponible. Reessayez dans quelques instants.");
    }

    const data = (await response.json()) as T;
    const nextToken = getStoredAccessToken();
    const expiresAt = getAccessTokenExpiryMs(nextToken);

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        data,
        expiresAt,
        tokenSignature: getTokenSignature(nextToken),
        cachedAt: Date.now(),
      }),
    );

    return data;
  })().finally(() => {
    inFlightJsonRequests.delete(requestKey);
  });

  inFlightJsonRequests.set(requestKey, request);

  return (await request) as T;
}
function buildGeoBoundaryPath(query: GeoBoundaryQuery) {
  const params = new URLSearchParams();

  if (query.type) {
    params.set("type", query.type);
  }

  if (query.search) {
    params.set("search", query.search);
  }

  if (query.countryCode) {
    params.set("countryCode", query.countryCode);
  }

  if (query.continent) {
    params.set("continent", query.continent);
  }

  if (query.limit) {
    params.set("limit", String(query.limit));
  }

  return `/geo-boundaries?${params.toString()}`;
}

export async function getGeoBoundaries<T = unknown>(
  query: GeoBoundaryQuery,
  force = false,
) {
  return cachedApiJson<T>(buildGeoBoundaryPath(query), force);
}

export async function warmAppCache() {
  const token = getStoredAccessToken();

  if (!token || getAccessTokenExpiryMs(token) <= Date.now()) {
    return;
  }

  const endpoints = [
    "/dashboard/summary",
    "/devices",
    "/locks",
  ];

  await Promise.allSettled(endpoints.map((endpoint) => cachedApiJson(endpoint)));
}

