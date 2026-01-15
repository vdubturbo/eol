import { Router } from 'express';
import { upsertComponent, upsertPinouts, getOrCreateManufacturer } from '../db/queries';

const router = Router();

// Manual component import
router.post('/components', async (req, res) => {
  try {
    const { mpn, manufacturer, description, package_raw, package_normalized,
            mounting_style, pin_count, specs, lifecycle_status, datasheet_url,
            data_sources, confidence_score, pinouts } = req.body;

    if (!mpn) {
      return res.status(400).json({ message: 'mpn is required' });
    }

    // Create/get manufacturer
    let manufacturerId: string | undefined;
    if (manufacturer) {
      const mfr = await getOrCreateManufacturer(manufacturer);
      manufacturerId = mfr.id;
    }

    // Upsert component
    const component = await upsertComponent({
      mpn,
      manufacturer_id: manufacturerId,
      description,
      package_raw,
      package_normalized,
      mounting_style,
      pin_count,
      specs: specs || {},
      lifecycle_status: lifecycle_status || 'Unknown',
      datasheet_url,
      data_sources: data_sources || ['manual'],
      confidence_score: confidence_score ?? 1.0
    });

    // Upsert pinouts if provided
    if (pinouts && Array.isArray(pinouts)) {
      await upsertPinouts(component.id, pinouts.map(p => ({
        pin_number: p.pin_number,
        pin_name: p.pin_name,
        pin_function: p.pin_function || 'OTHER',
        pin_description: p.pin_description,
        source: 'manual',
        confidence: p.confidence ?? 1.0
      })));
    }

    // Fetch the complete component with relations
    res.json(component);
  } catch (error) {
    console.error('Manual import error:', error);
    res.status(500).json({ message: 'Import failed' });
  }
});

// Bulk import
router.post('/components/bulk', async (req, res) => {
  try {
    const { components } = req.body;

    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ message: 'components array is required' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const comp of components) {
      try {
        let manufacturerId: string | undefined;
        if (comp.manufacturer) {
          const mfr = await getOrCreateManufacturer(comp.manufacturer);
          manufacturerId = mfr.id;
        }

        const component = await upsertComponent({
          mpn: comp.mpn,
          manufacturer_id: manufacturerId,
          description: comp.description,
          package_raw: comp.package_raw,
          package_normalized: comp.package_normalized,
          mounting_style: comp.mounting_style,
          pin_count: comp.pin_count,
          specs: comp.specs || {},
          lifecycle_status: comp.lifecycle_status || 'Unknown',
          datasheet_url: comp.datasheet_url,
          data_sources: comp.data_sources || ['manual'],
          confidence_score: comp.confidence_score ?? 1.0
        });

        if (comp.pinouts && Array.isArray(comp.pinouts)) {
          await upsertPinouts(component.id, comp.pinouts);
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${comp.mpn}: ${(error as Error).message}`);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Bulk import failed' });
  }
});

export default router;
