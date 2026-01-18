import { Router } from 'express';
import { supabaseAdmin } from '../db/supabase';
import { getCacheStats, getOrExtractDatasheet } from '../services/datasheetCache';

const router = Router();

// Get cache stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Get cache stats error:', error);
    res.status(500).json({ message: 'Failed to get cache stats' });
  }
});

// List cache entries with pagination
router.get('/', async (req, res) => {
  try {
    const { page = '1', pageSize = '25', status } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    let query = supabaseAdmin
      .from('datasheet_cache')
      .select('id, datasheet_url, status, page_count, text_length, extraction_model, extraction_tokens, extraction_cost, error_message, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(pageSize as string) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      entries: data || [],
      total: count || 0,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string)
    });
  } catch (error) {
    console.error('List cache entries error:', error);
    res.status(500).json({ message: 'Failed to list cache entries' });
  }
});

// Get single cache entry with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('datasheet_cache')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Cache entry not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get cache entry error:', error);
    res.status(500).json({ message: 'Failed to get cache entry' });
  }
});

// Force re-extraction for a URL
router.post('/reextract', async (req, res) => {
  try {
    const { url, mpnHint } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Delete existing cache entry
    await supabaseAdmin
      .from('datasheet_cache')
      .delete()
      .eq('datasheet_url', url);

    // Trigger new extraction
    const extraction = await getOrExtractDatasheet(url, mpnHint);

    if (!extraction) {
      return res.status(500).json({ message: 'Extraction failed' });
    }

    res.json({
      success: true,
      cacheId: extraction.id,
      packageVariants: Object.keys(extraction.pinouts_by_package).length,
      pageCount: extraction.page_count,
      textLength: extraction.text_length
    });
  } catch (error) {
    console.error('Re-extract error:', error);
    res.status(500).json({ message: 'Failed to re-extract datasheet' });
  }
});

// Delete cache entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('datasheet_cache')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete cache entry error:', error);
    res.status(500).json({ message: 'Failed to delete cache entry' });
  }
});

// Clear expired entries
router.post('/clear-expired', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('datasheet_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;

    res.json({
      success: true,
      deletedCount: data?.length || 0
    });
  } catch (error) {
    console.error('Clear expired error:', error);
    res.status(500).json({ message: 'Failed to clear expired entries' });
  }
});

// Clear failed entries
router.post('/clear-failed', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('datasheet_cache')
      .delete()
      .eq('status', 'failed')
      .select('id');

    if (error) throw error;

    res.json({
      success: true,
      deletedCount: data?.length || 0
    });
  } catch (error) {
    console.error('Clear failed error:', error);
    res.status(500).json({ message: 'Failed to clear failed entries' });
  }
});

// Get components using a specific cache entry
router.get('/:id/components', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('components')
      .select('id, mpn, manufacturer:manufacturers(name), package_normalized, pinout_source')
      .eq('datasheet_cache_id', id);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Get components for cache error:', error);
    res.status(500).json({ message: 'Failed to get components' });
  }
});

export default router;
