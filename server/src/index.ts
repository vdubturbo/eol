import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import searchRoutes from './routes/search';
import componentsRoutes from './routes/components';
import adminRoutes from './routes/admin';
import ingestionRoutes from './routes/ingestion';
import { closeQueue } from './workers/queue';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true, // Allow all origins if not specified
  credentials: true,
}));
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ name: 'ComponentDB API', status: 'running' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/search', searchRoutes);
app.use('/api/components', componentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ingestion', ingestionRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`ComponentDB server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);

  server.close(() => {
    console.log('HTTP server closed');
  });

  await closeQueue();
  console.log('Redis connections closed');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
