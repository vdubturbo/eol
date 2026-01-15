import { Router } from 'express';
import { getDashboardStats, createJob, updateJob, getJobById } from '../db/queries';
import { supabaseAdmin } from '../db/supabase';
import { ingestionQueue } from '../workers/queue';

const router = Router();

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// List jobs
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = '50' } = req.query;

    let query = supabaseAdmin
      .from('ingestion_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ message: 'Failed to list jobs' });
  }
});

// Create job
router.post('/jobs', async (req, res) => {
  try {
    const { job_type, source, category, part_numbers } = req.body;

    if (!job_type) {
      return res.status(400).json({ message: 'job_type is required' });
    }

    // Create job record
    const job = await createJob({
      job_type,
      status: 'pending',
      params: { source, category, part_numbers },
      total_items: part_numbers?.length || 0
    });

    // Queue the job for processing
    try {
      await ingestionQueue.add(job_type, {
        jobId: job.id,
        source,
        category,
        partNumbers: part_numbers
      });
    } catch (queueError) {
      console.warn('Queue not available, job created but not queued:', queueError);
    }

    res.json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Failed to create job' });
  }
});

// Get job by ID
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(404).json({ message: 'Job not found' });
  }
});

// Retry failed job
router.post('/jobs/:id/retry', async (req, res) => {
  try {
    const job = await getJobById(req.params.id);

    if (!job || job.status !== 'failed') {
      return res.status(400).json({ message: 'Job cannot be retried' });
    }

    const updatedJob = await updateJob(req.params.id, {
      status: 'pending',
      error_message: null,
      retry_count: (job.retry_count || 0) + 1
    });

    // Re-queue
    try {
      await ingestionQueue.add(job.job_type, {
        jobId: job.id,
        ...job.params
      });
    } catch (queueError) {
      console.warn('Queue not available:', queueError);
    }

    res.json(updatedJob);
  } catch (error) {
    console.error('Retry job error:', error);
    res.status(500).json({ message: 'Retry failed' });
  }
});

// Cancel job
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const job = await getJobById(req.params.id);

    if (!job || !['pending', 'processing'].includes(job.status)) {
      return res.status(400).json({ message: 'Job cannot be cancelled' });
    }

    const updatedJob = await updateJob(req.params.id, {
      status: 'cancelled'
    });

    res.json(updatedJob);
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ message: 'Cancel failed' });
  }
});

// API usage
router.get('/api-usage', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string));

    const { data, error } = await supabaseAdmin
      .from('api_usage')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('API usage error:', error);
    res.status(500).json({ message: 'Failed to get API usage' });
  }
});

// API usage summary
router.get('/api-usage/summary', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string));

    const { data, error } = await supabaseAdmin
      .from('api_usage')
      .select('api_name, request_count, parts_returned, estimated_cost')
      .gte('created_at', since.toISOString());

    if (error) throw error;

    // Aggregate by API name
    const summary = (data || []).reduce((acc, row) => {
      if (!acc[row.api_name]) {
        acc[row.api_name] = {
          api_name: row.api_name,
          total_requests: 0,
          total_parts: 0,
          total_cost: 0
        };
      }
      acc[row.api_name].total_requests += row.request_count || 0;
      acc[row.api_name].total_parts += row.parts_returned || 0;
      acc[row.api_name].total_cost += row.estimated_cost || 0;
      return acc;
    }, {} as Record<string, { api_name: string; total_requests: number; total_parts: number; total_cost: number }>);

    res.json(Object.values(summary));
  } catch (error) {
    console.error('API usage summary error:', error);
    res.status(500).json({ message: 'Failed to get API usage summary' });
  }
});

export default router;
