type RedisClient = {
  connect: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttl: number) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();
let redisClient: RedisClient | null = null;
let redisUnavailable = false;

async function getRedisClient(): Promise<RedisClient | null> {
  if (redisUnavailable) return null;
  if (redisClient) return redisClient;

  try {
    const module = await import("ioredis");
    const RedisCtor = (module.default ?? module) as unknown as new (
      url: string,
      options: Record<string, unknown>
    ) => RedisClient;

    redisClient = new RedisCtor(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });

    redisClient.on("error", () => {
      redisUnavailable = true;
      redisClient = null;
    });

    return redisClient;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      await redis.connect();
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      // fallback to in-memory cache
    }
  }

  const memoryHit = memoryStore.get(key);
  if (!memoryHit) return null;
  if (memoryHit.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return JSON.parse(memoryHit.value) as T;
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const payload = JSON.stringify(value);
  const redis = await getRedisClient();

  if (redis) {
    try {
      await redis.connect();
      await redis.set(key, payload, "EX", ttlSeconds);
      return;
    } catch {
      // fallback to in-memory cache
    }
  }

  memoryStore.set(key, {
    value: payload,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}
