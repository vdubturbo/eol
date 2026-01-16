import { Queue } from 'bullmq';
import Redis from 'ioredis';

let connection: Redis | null = null;
let queue: Queue | null = null;
let connectionFailed = false;
let initLogged = false;

function isValidRedisUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Check for placeholder values
  if (url.includes('xxx') || url.includes('placeholder') || url.includes('your-')) return false;
  // Basic URL validation
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
  } catch {
    return false;
  }
}

function getConnection(): Redis | null {
  if (connectionFailed) return null;

  if (!connection) {
    const redisUrl = process.env.REDIS_URL;

    if (!isValidRedisUrl(redisUrl)) {
      if (!initLogged) {
        console.log('[Queue] Redis not configured or invalid URL - job queue disabled');
        initLogged = true;
      }
      connectionFailed = true;
      return null;
    }

    try {
      connection = new Redis(redisUrl!, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('[Queue] Redis connection failed after 3 retries - disabling queue');
            connectionFailed = true;
            return null; // Stop retrying
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true, // Don't connect immediately
      });

      // Handle connection errors silently after initial warning
      connection.on('error', (err) => {
        if (!connectionFailed) {
          console.warn('[Queue] Redis connection error:', err.message);
          connectionFailed = true;
        }
      });

      // Attempt connection
      connection.connect().catch(() => {
        connectionFailed = true;
      });

      if (!initLogged) {
        console.log('[Queue] Redis connection initialized');
        initLogged = true;
      }
    } catch (error) {
      console.warn('[Queue] Failed to create Redis connection:', error);
      connectionFailed = true;
      return null;
    }
  }

  return connection;
}

function getQueue(): Queue | null {
  if (connectionFailed) return null;

  if (!queue) {
    const conn = getConnection();
    if (!conn) return null;

    // Type assertion needed due to ioredis version mismatch between bullmq's bundled version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queue = new Queue('ingestion', { connection: conn as any });
  }

  return queue;
}

// Proxy object that lazily initializes the queue
export const ingestionQueue = {
  isAvailable: () => !connectionFailed && getQueue() !== null,

  add: async (name: string, data: Record<string, unknown>, opts?: object) => {
    const q = getQueue();
    if (!q) return null;

    try {
      return await q.add(name, data, opts);
    } catch (error) {
      if (!connectionFailed) {
        console.warn('[Queue] Failed to add job:', error);
      }
      return null;
    }
  },

  getJob: async (id: string) => {
    const q = getQueue();
    if (!q) return null;

    try {
      return await q.getJob(id);
    } catch {
      return null;
    }
  },

  getJobs: async (statuses: string[]) => {
    const q = getQueue();
    if (!q) return [];

    try {
      return await q.getJobs(statuses as Array<'completed' | 'failed' | 'delayed' | 'active' | 'wait' | 'paused' | 'repeat' | 'prioritized'>);
    } catch {
      return [];
    }
  }
};

// Clean shutdown
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
