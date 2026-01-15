import { updateJob, upsertComponent, upsertPinouts, getOrCreateManufacturer } from '../db/queries';
import * as nexar from '../services/nexar';
import * as digikey from '../services/digikey';
import * as mouser from '../services/mouser';
import * as lcsc from '../services/lcsc';
import { normalizePackage, extractPinCount, getMountingStyle } from '../services/normalizer';
import type { DataSource } from '../types';

interface FetchJobData {
  jobId: string;
  source: DataSource;
  category?: string;
  partNumbers?: string[];
}

export async function processApiFetch(
  jobId: string,
  source: DataSource,
  category?: string,
  partNumbers?: string[]
): Promise<void> {
  console.log(`Processing API fetch job ${jobId} from ${source}`);

  try {
    // Mark job as processing
    await updateJob(jobId, {
      status: 'processing',
      started_at: new Date().toISOString()
    });

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // If specific part numbers, fetch those
    if (partNumbers && partNumbers.length > 0) {
      await updateJob(jobId, { total_items: partNumbers.length });

      for (const mpn of partNumbers) {
        try {
          await fetchAndStorePart(mpn, source);
          processed++;
        } catch (error) {
          failed++;
          errors.push(`${mpn}: ${(error as Error).message}`);
        }

        // Update progress
        await updateJob(jobId, {
          processed_items: processed,
          failed_items: failed
        });
      }
    }
    // If category search, search and store results
    else if (category) {
      const parts = await searchByCategory(category, source);
      await updateJob(jobId, { total_items: parts.length });

      for (const part of parts) {
        try {
          await storeNormalizedPart(part, source);
          processed++;
        } catch (error) {
          failed++;
          errors.push(`${part.mpn}: ${(error as Error).message}`);
        }

        await updateJob(jobId, {
          processed_items: processed,
          failed_items: failed
        });
      }
    }

    // Mark job complete
    await updateJob(jobId, {
      status: failed === 0 ? 'completed' : 'completed',
      completed_at: new Date().toISOString(),
      result: {
        processed,
        failed,
        errors: errors.slice(0, 100) // Limit stored errors
      }
    });

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJob(jobId, {
      status: 'failed',
      error_message: (error as Error).message,
      completed_at: new Date().toISOString()
    });
  }
}

async function fetchAndStorePart(mpn: string, source: DataSource): Promise<void> {
  let normalizedPart: NormalizedPart | null = null;

  switch (source) {
    case 'nexar': {
      const part = await nexar.getPartByMpn(mpn);
      if (part) normalizedPart = nexar.normalizeNexarPart(part) as NormalizedPart;
      break;
    }
    case 'digikey': {
      const part = await digikey.getPartByMpn(mpn);
      if (part) normalizedPart = digikey.normalizeDigiKeyPart(part) as NormalizedPart;
      break;
    }
    case 'mouser': {
      const part = await mouser.getPartByMpn(mpn);
      if (part) normalizedPart = mouser.normalizeMouserPart(part) as NormalizedPart;
      break;
    }
    case 'lcsc': {
      const part = await lcsc.getPartByNumber(mpn);
      if (part) normalizedPart = lcsc.normalizeLCSCPart(part) as NormalizedPart;
      break;
    }
  }

  if (!normalizedPart) {
    throw new Error(`Part not found in ${source}`);
  }

  await storeNormalizedPart(normalizedPart, source);
}

interface NormalizedPart {
  mpn: string;
  manufacturer: string;
  description?: string;
  datasheet_url?: string;
  package_raw?: string;
  lifecycle_status?: string;
  specs?: Record<string, unknown>;
}

async function storeNormalizedPart(part: NormalizedPart, source: DataSource): Promise<void> {
  // Get/create manufacturer
  const manufacturer = await getOrCreateManufacturer(part.manufacturer);

  // Normalize package
  const packageNormalized = part.package_raw ? normalizePackage(part.package_raw) : null;
  const pinCount = packageNormalized ? extractPinCount(packageNormalized) : null;
  const mountingStyle = packageNormalized ? getMountingStyle(packageNormalized) : null;

  // Upsert component
  await upsertComponent({
    mpn: part.mpn,
    manufacturer_id: manufacturer.id,
    description: part.description,
    package_raw: part.package_raw,
    package_normalized: packageNormalized,
    pin_count: pinCount,
    mounting_style: mountingStyle,
    specs: part.specs || {},
    lifecycle_status: (part.lifecycle_status as 'Active' | 'NRND' | 'Obsolete' | 'Unknown') || 'Unknown',
    datasheet_url: part.datasheet_url,
    data_sources: [source],
    confidence_score: 0.7
  });
}

async function searchByCategory(category: string, source: DataSource): Promise<NormalizedPart[]> {
  switch (source) {
    case 'nexar': {
      const parts = await nexar.searchParts(category, 50);
      return parts.map(p => nexar.normalizeNexarPart(p) as NormalizedPart);
    }
    case 'digikey': {
      const parts = await digikey.searchParts(category, 50);
      return parts.map(p => digikey.normalizeDigiKeyPart(p) as NormalizedPart);
    }
    case 'mouser': {
      const parts = await mouser.searchParts(category, 50);
      return parts.map(p => mouser.normalizeMouserPart(p) as NormalizedPart);
    }
    case 'lcsc': {
      const parts = await lcsc.searchParts(category, 50);
      return parts.map(p => lcsc.normalizeLCSCPart(p) as NormalizedPart);
    }
    default:
      return [];
  }
}
