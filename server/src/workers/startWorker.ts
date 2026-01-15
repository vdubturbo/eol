import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('REDIS_URL environment variable is required');
  process.exit(1);
}

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

console.log('Starting ingestion worker...');

const worker = new Worker(
  'ingestion',
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);
    const { jobId, source, category, partNumbers } = job.data;

    switch (job.name) {
      case 'api_fetch': {
        const { processApiFetch } = await import('./ingestionWorker');
        return processApiFetch(jobId, source, category, partNumbers);
      }
      case 'pdf_extract': {
        const { processPdfExtract } = await import('./pdfWorker');
        return processPdfExtract(jobId);
      }
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    // Type assertion needed due to ioredis version mismatch between bullmq's bundled version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: connection as any,
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
});

console.log('Worker started and listening for jobs');
