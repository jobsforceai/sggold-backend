/**
 * Dual-layer cache: Redis (persistent, shared) + In-Memory (fast fallback).
 * Both layers are always written to. Reads check in-memory first (fastest),
 * then Redis. This means switching between tabs/filters is instant from memory,
 * and data survives server restarts via Redis.
 */

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

/* ─── Redis Setup ─── */

type RedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  status?: string;
};

let redis: RedisLike | null = null;
let redisReady = false;
let redisInitAttempted = false;

async function getRedis(): Promise<RedisLike | null> {
  if (redis && redisReady) return redis;
  if (redisInitAttempted && !redisReady) return null;
  redisInitAttempted = true;

  try {
    const mod = await import("ioredis");
    const Ctor = (mod.default ?? mod) as unknown as new (
      url: string,
      opts: Record<string, unknown>
    ) => RedisLike;

    // Support both REDIS_URL (single string) and individual REDIS_HOST/PORT/etc params
    const redisHost = process.env.REDIS_HOST ?? "localhost";
    const redisPort = Number(process.env.REDIS_PORT) || 6379;
    const redisUsername = process.env.REDIS_USERNAME || undefined;
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisTls = process.env.REDIS_USETLS === "true";
    const redisUrl = process.env.REDIS_URL;

    const connectionOpts: Record<string, unknown> = {
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
      enableOfflineQueue: true,
      connectTimeout: 5000,
    };

    if (!redisUrl) {
      connectionOpts.host = redisHost;
      connectionOpts.port = redisPort;
      if (redisUsername) connectionOpts.username = redisUsername;
      if (redisPassword) connectionOpts.password = redisPassword;
      if (redisTls) connectionOpts.tls = {};
    }

    const client = new Ctor(redisUrl ?? `redis://${redisHost}:${redisPort}`, connectionOpts);

    client.on("ready", () => {
      redisReady = true;
      console.log("[cache] Redis connected");
    });
    client.on("error", () => {
      redisReady = false;
    });
    client.on("close", () => {
      redisReady = false;
    });
    client.on("reconnecting", () => {
      redisReady = false;
    });

    redis = client;

    // Wait briefly for initial connection
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 2000);
      client.on("ready", () => { clearTimeout(timeout); resolve(); });
      client.on("error", () => { clearTimeout(timeout); resolve(); });
    });

    return redisReady ? redis : null;
  } catch {
    console.warn("[cache] Redis unavailable, using in-memory only");
    return null;
  }
}

/* ─── Public API ─── */

export async function getCache<T>(key: string): Promise<T | null> {
  // Check in-memory first (fastest)
  const memHit = memoryStore.get(key);
  if (memHit) {
    if (memHit.expiresAt > Date.now()) {
      return JSON.parse(memHit.value) as T;
    }
    memoryStore.delete(key);
  }

  // Check Redis
  const client = await getRedis();
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        // Warm in-memory cache from Redis hit (60s local TTL)
        memoryStore.set(key, { value: raw, expiresAt: Date.now() + 60_000 });
        return parsed;
      }
    } catch {
      // Redis read failed, continue without
    }
  }

  return null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const payload = JSON.stringify(value);

  // Always write to in-memory
  memoryStore.set(key, {
    value: payload,
    expiresAt: Date.now() + ttlSeconds * 1000
  });

  // Also write to Redis (non-blocking)
  const client = await getRedis();
  if (client) {
    try {
      await client.set(key, payload, "EX", ttlSeconds);
    } catch {
      // Redis write failed, in-memory still has it
    }
  }
}

/* ─── Periodic cleanup of expired in-memory entries ─── */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt < now) memoryStore.delete(key);
  }
}, 60_000);
