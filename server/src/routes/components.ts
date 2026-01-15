import { Router } from 'express';
import { getComponentById, searchComponents } from '../db/queries';
import { supabaseAdmin } from '../db/supabase';

const router = Router();

// Get component by ID
router.get('/:id', async (req, res) => {
  try {
    const component = await getComponentById(req.params.id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }
    res.json(component);
  } catch (error) {
    console.error('Get component error:', error);
    res.status(500).json({ message: 'Failed to get component' });
  }
});

// Search components
router.get('/', async (req, res) => {
  try {
    const {
      query,
      package: pkg,
      mounting_style,
      pin_count,
      lifecycle_status,
      manufacturer_id,
      page = '1',
      page_size = '25'
    } = req.query;

    const result = await searchComponents(
      {
        query: query as string,
        package: pkg as string,
        mounting_style: mounting_style as string,
        pin_count: pin_count ? parseInt(pin_count as string) : undefined,
        lifecycle_status: lifecycle_status
          ? (lifecycle_status as string).split(',')
          : undefined,
        manufacturer_id: manufacturer_id as string
      },
      parseInt(page as string),
      parseInt(page_size as string)
    );

    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

// Compare multiple components
router.post('/compare', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array required' });
    }

    const { data, error } = await supabaseAdmin
      .from('components')
      .select(`
        *,
        manufacturer:manufacturers(*),
        pinouts(*),
        dimensions:package_dimensions(*)
      `)
      .in('id', ids);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ message: 'Compare failed' });
  }
});

// Get filter options
router.get('/meta/filters', async (req, res) => {
  try {
    const [packagesResult, manufacturersResult] = await Promise.all([
      supabaseAdmin
        .from('components')
        .select('package_normalized')
        .not('package_normalized', 'is', null)
        .order('package_normalized'),
      supabaseAdmin
        .from('manufacturers')
        .select('id, name')
        .order('name')
    ]);

    const packages = [...new Set(
      packagesResult.data?.map(p => p.package_normalized).filter(Boolean)
    )] as string[];

    res.json({
      packages,
      manufacturers: manufacturersResult.data || []
    });
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ message: 'Failed to get filter options' });
  }
});

export default router;
