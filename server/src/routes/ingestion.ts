import { Router } from 'express';
import { upsertComponent, upsertPinouts, getOrCreateManufacturer } from '../db/queries';
import { importPartByMpn, importPartsBatch, importPartFamily } from '../services/ingestion';

const router = Router();

// Import parts from APIs (used by Admin Import UI)
router.post('/import', async (req, res) => {
  try {
    const { mpns, source, extractPinouts, skipExisting } = req.body;

    if (!Array.isArray(mpns) || mpns.length === 0) {
      return res.status(400).json({ message: 'mpns array is required' });
    }

    if (mpns.length > 50) {
      return res.status(400).json({ message: 'Maximum 50 MPNs per batch' });
    }

    // Map source to API sources
    const sources: ('nexar' | 'digikey')[] =
      source === 'digikey' ? ['digikey'] :
      source === 'nexar' ? ['nexar'] :
      ['nexar', 'digikey'];

    console.log(`[Route] Import request for ${mpns.length} MPNs from ${sources.join(', ')}`);

    const results = await importPartsBatch(mpns, {
      extractPinouts: extractPinouts ?? false,
      skipExisting: skipExisting ?? true,
      sources
    });

    // Calculate stats for frontend
    const added = results.filter(r => r.success && r.componentId).length;
    const skipped = results.filter(r => r.success && !r.componentId && r.error?.includes('Skipped')).length;
    const updated = 0; // Would need to track this in the service
    const pinouts = results.reduce((sum, r) => sum + r.pinoutsExtracted, 0);
    const errors = results
      .filter(r => !r.success)
      .map(r => `${r.mpn}: ${r.error || 'Unknown error'}`);

    res.json({
      added,
      skipped,
      updated,
      pinouts,
      errors
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      added: 0,
      updated: 0,
      pinouts: 0,
      errors: [(error as Error).message || 'Import failed']
    });
  }
});

// Import a part family (all variants of a base MPN)
router.post('/import-family', async (req, res) => {
  try {
    const { baseMpn, extractPinouts, skipExisting } = req.body;

    if (!baseMpn || typeof baseMpn !== 'string') {
      return res.status(400).json({ message: 'baseMpn is required' });
    }

    console.log(`[Route] Family import request for base MPN: ${baseMpn}`);

    const result = await importPartFamily(baseMpn, {
      extractPinouts: extractPinouts ?? false,
      skipExisting: skipExisting ?? true,
      sources: ['digikey'] // Family search uses DigiKey
    });

    res.json(result);
  } catch (error) {
    console.error('Family import error:', error);
    res.status(500).json({
      baseMpn: req.body.baseMpn || '',
      variantsFound: 0,
      imported: 0,
      errors: [(error as Error).message || 'Family import failed'],
      variants: []
    });
  }
});

// Import a part by MPN from external APIs
router.post('/import/mpn', async (req, res) => {
  try {
    const { mpn, options } = req.body;

    if (!mpn) {
      return res.status(400).json({ message: 'mpn is required' });
    }

    console.log(`[Route] Import request for MPN: ${mpn}`);
    const result = await importPartByMpn(mpn, options);

    if (result.success) {
      res.json({
        message: 'Import successful',
        ...result
      });
    } else {
      res.status(404).json({
        message: 'Import failed',
        ...result
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: 'Import failed' });
  }
});

// Batch import multiple MPNs
router.post('/import/batch', async (req, res) => {
  try {
    const { mpns, options } = req.body;

    if (!Array.isArray(mpns) || mpns.length === 0) {
      return res.status(400).json({ message: 'mpns array is required' });
    }

    if (mpns.length > 50) {
      return res.status(400).json({ message: 'Maximum 50 MPNs per batch' });
    }

    console.log(`[Route] Batch import request for ${mpns.length} MPNs`);
    const results = await importPartsBatch(mpns, options);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      message: `Batch import complete: ${successful} successful, ${failed} failed`,
      total: mpns.length,
      successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Batch import error:', error);
    res.status(500).json({ message: 'Batch import failed' });
  }
});

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
