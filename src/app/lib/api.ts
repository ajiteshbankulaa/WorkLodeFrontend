export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CacheEntry>();

type RequestOptions = {
  token?: string | null;
  cacheTtlMs?: number;
  signal?: AbortSignal;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

export async function requestJson<T>(
  path: string,
  { token, cacheTtlMs = 0, signal, method = "GET", headers = {}, body = null }: RequestOptions = {}
): Promise<T> {
  const cacheKey = method === "GET" ? `${path}::${token || "public"}` : null;
  const now = Date.now();

  if (cacheKey && cacheTtlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }
  }

  const requestHeaders: Record<string, string> = { ...headers };
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body,
    signal,
  });

  const data = (await response.json().catch(() => ({}))) as T & { detail?: string; message?: string };
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Request failed (${response.status})`);
  }

  if (cacheKey && cacheTtlMs > 0) {
    responseCache.set(cacheKey, {
      expiresAt: now + cacheTtlMs,
      value: data,
    });
  }

  return data;
}

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}
