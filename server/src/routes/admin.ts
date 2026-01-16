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

// User Management

// Get current user's profile by ID (bypasses RLS via service role)
router.get('/users/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Get profile error:', error);
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// List all users (admin only - uses service role)
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Failed to list users' });
  }
});

// Delete user (admin only - requires service role key)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Delete from auth.users (will cascade to user_profiles via FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      console.error('Delete user error:', error);
      return res.status(400).json({ message: error.message });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// ============== Parts Management ==============

// List parts with pagination, sorting, filtering
router.get('/parts', async (req, res) => {
  try {
    const {
      query,
      lifecycle_status,
      manufacturer_id,
      has_pinouts,
      sort_by = 'updated_at',
      sort_order = 'desc',
      page = '1',
      page_size = '50'
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(page_size as string);
    const offset = (pageNum - 1) * pageSizeNum;

    // Build query
    let dbQuery = supabaseAdmin
      .from('components')
      .select(`
        id,
        mpn,
        description,
        package_normalized,
        pin_count,
        lifecycle_status,
        data_sources,
        datasheet_url,
        created_at,
        updated_at,
        manufacturer:manufacturers(id, name),
        pinouts(id)
      `, { count: 'exact' });

    // Apply filters
    if (query) {
      dbQuery = dbQuery.or(`mpn.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (lifecycle_status) {
      const statuses = (lifecycle_status as string).split(',');
      dbQuery = dbQuery.in('lifecycle_status', statuses);
    }
    if (manufacturer_id) {
      dbQuery = dbQuery.eq('manufacturer_id', manufacturer_id);
    }

    // Apply sorting
    const validSortFields = ['mpn', 'lifecycle_status', 'package_normalized', 'pin_count', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by as string : 'updated_at';
    dbQuery = dbQuery.order(sortField, { ascending: sort_order === 'asc' });

    // Apply pagination
    dbQuery = dbQuery.range(offset, offset + pageSizeNum - 1);

    const { data, error, count } = await dbQuery;
    if (error) throw error;

    // Transform to include has_pinouts flag
    const parts = (data || []).map(part => ({
      ...part,
      has_pinouts: part.pinouts && part.pinouts.length > 0,
      pinout_count: part.pinouts?.length || 0,
      pinouts: undefined // Remove pinouts array from response
    }));

    // Filter by has_pinouts if specified (done after query since Supabase can't filter on aggregates)
    let filteredParts = parts;
    if (has_pinouts !== undefined) {
      const wantsPinouts = has_pinouts === 'true';
      filteredParts = parts.filter(p => p.has_pinouts === wantsPinouts);
    }

    res.json({
      parts: filteredParts,
      total: count || 0,
      page: pageNum,
      page_size: pageSizeNum
    });
  } catch (error) {
    console.error('List parts error:', error);
    res.status(500).json({ message: 'Failed to list parts' });
  }
});

// Bulk delete parts
router.post('/parts/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array required' });
    }

    // Delete pinouts first (FK constraint)
    await supabaseAdmin
      .from('pinouts')
      .delete()
      .in('component_id', ids);

    // Delete package dimensions
    await supabaseAdmin
      .from('package_dimensions')
      .delete()
      .in('component_id', ids);

    // Delete components
    const { error } = await supabaseAdmin
      .from('components')
      .delete()
      .in('id', ids);

    if (error) throw error;

    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: 'Failed to delete parts' });
  }
});

// Re-process parts (extract pinouts)
router.post('/parts/reprocess', async (req, res) => {
  try {
    const { ids, extractPinouts = true } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array required' });
    }

    // Get the MPNs for these components
    const { data: components, error: fetchError } = await supabaseAdmin
      .from('components')
      .select('id, mpn')
      .in('id', ids);

    if (fetchError) throw fetchError;

    const mpns = components?.map(c => c.mpn) || [];

    // If extractPinouts is true, delete existing pinouts first
    if (extractPinouts) {
      await supabaseAdmin
        .from('pinouts')
        .delete()
        .in('component_id', ids);
    }

    // Create a job for reprocessing
    const job = await createJob({
      job_type: 'full_import',
      status: 'pending',
      params: {
        part_numbers: mpns,
        extractPinouts,
        reprocess: true
      },
      total_items: mpns.length
    });

    // Queue the job
    try {
      await ingestionQueue.add('full_import', {
        jobId: job.id,
        partNumbers: mpns,
        extractPinouts,
        reprocess: true
      });
    } catch (queueError) {
      console.warn('Queue not available:', queueError);
    }

    res.json({
      success: true,
      jobId: job.id,
      partsQueued: mpns.length
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    res.status(500).json({ message: 'Failed to queue reprocessing' });
  }
});

// ============== User Management ==============

// Update user role (admin only)
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Valid role is required (user or admin)' });
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

export default router;
