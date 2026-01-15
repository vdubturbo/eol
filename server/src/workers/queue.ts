import { Queue } from 'bullmq';
import Redis from 'ioredis';

let connection: Redis | null = null;
let queue: Queue | null = null;

function getConnection(): Redis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn('REDIS_URL not configured - job queue disabled');
      // Return a mock connection that will fail gracefully
      throw new Error('Redis not configured');
    }

    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  return connection;
}

function getQueue(): Queue {
  if (!queue) {
    const conn = getConnection();
    // Type assertion needed due to ioredis version mismatch between bullmq's bundled version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queue = new Queue('ingestion', { connection: conn as any });
  }

  return queue;
}

// Proxy object that lazily initializes the queue
export const ingestionQueue = {
  add: async (name: string, data: Record<string, unknown>, opts?: object) => {
    try {
      const q = getQueue();
      return await q.add(name, data, opts);
    } catch (error) {
      console.warn('Queue not available:', error);
      return null;
    }
  },

  getJob: async (id: string) => {
    try {
      const q = getQueue();
      return await q.getJob(id);
    } catch {
      return null;
    }
  },

  getJobs: async (statuses: string[]) => {
    try {
      const q = getQueue();
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
