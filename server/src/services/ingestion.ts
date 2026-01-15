import { getPartByMpn as getNexarPart, normalizeNexarPart } from './nexar';
import { getPartByMpn as getDigiKeyPart, normalizeDigiKeyPart } from './digikey';
import { extractFromUrl } from './pdfExtractor';
import { extractPinoutsWithLLM, extractSpecsWithLLM, mapToPinFunction } from './llmExtractor';
import { upsertComponent, upsertPinouts, getOrCreateManufacturer } from '../db/queries';
import type { ExtractedPinout, DataSource, LifecycleStatus } from '../types';

export interface ImportResult {
  success: boolean;
  mpn: string;
  componentId?: string;
  dataSources: DataSource[];
  pinoutsExtracted: number;
  error?: string;
}

export interface ImportOptions {
  extractPinouts?: boolean;
  sources?: ('nexar' | 'digikey')[];
}

export async function importPartByMpn(
  mpn: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const {
    extractPinouts = true,
    sources = ['nexar', 'digikey']
  } = options;

  const result: ImportResult = {
    success: false,
    mpn,
    dataSources: [],
    pinoutsExtracted: 0
  };

  try {
    console.log(`[Ingestion] Starting import for MPN: ${mpn}`);

    // Step 1: Lookup part from API sources
    let partData: {
      mpn: string;
      manufacturer: string;
      description: string;
      datasheet_url?: string;
      lifecycle_status?: string;
      specs: Record<string, unknown>;
    } | null = null;

    // Try Nexar first
    if (sources.includes('nexar')) {
      try {
        console.log(`[Ingestion] Looking up ${mpn} on Nexar...`);
        const nexarPart = await getNexarPart(mpn);
        if (nexarPart) {
          partData = normalizeNexarPart(nexarPart);
          result.dataSources.push('nexar');
          console.log(`[Ingestion] Found on Nexar: ${partData.manufacturer}`);
        }
      } catch (err) {
        console.warn(`[Ingestion] Nexar lookup failed:`, err);
      }
    }

    // Fall back to DigiKey if Nexar didn't find it
    if (!partData && sources.includes('digikey')) {
      try {
        console.log(`[Ingestion] Looking up ${mpn} on DigiKey...`);
        const digiKeyPart = await getDigiKeyPart(mpn);
        if (digiKeyPart) {
          partData = normalizeDigiKeyPart(digiKeyPart);
          result.dataSources.push('digikey');
          console.log(`[Ingestion] Found on DigiKey: ${partData.manufacturer}`);
        }
      } catch (err) {
        console.warn(`[Ingestion] DigiKey lookup failed:`, err);
      }
    }

    if (!partData) {
      result.error = `Part ${mpn} not found in any API source`;
      return result;
    }

    // Step 2: Get or create manufacturer
    const manufacturer = await getOrCreateManufacturer(partData.manufacturer);

    // Step 3: Extract pinouts from datasheet if URL available
    let extractedPinouts: ExtractedPinout[] = [];

    if (extractPinouts && partData.datasheet_url) {
      try {
        console.log(`[Ingestion] Extracting PDF from: ${partData.datasheet_url}`);
        const pdfData = await extractFromUrl(partData.datasheet_url);
        console.log(`[Ingestion] PDF extracted: ${pdfData.pages} pages, ${pdfData.text.length} chars`);

        console.log(`[Ingestion] Running LLM extraction...`);
        extractedPinouts = await extractPinoutsWithLLM(pdfData.text);
        result.dataSources.push('pdf');
        console.log(`[Ingestion] Extracted ${extractedPinouts.length} pinouts`);

        // Also extract specs if not already present
        if (Object.keys(partData.specs).length === 0) {
          const extractedSpecs = await extractSpecsWithLLM(pdfData.text);
          partData.specs = { ...partData.specs, ...extractedSpecs };
        }
      } catch (err) {
        console.warn(`[Ingestion] PDF extraction failed:`, err);
      }
    }

    // Step 4: Determine pin count from extracted pinouts or specs
    const pinCount = extractedPinouts.length > 0
      ? Math.max(...extractedPinouts.map(p => p.pin_number))
      : undefined;

    // Step 5: Save component to database
    console.log(`[Ingestion] Saving component to database...`);
    const component = await upsertComponent({
      mpn: partData.mpn,
      manufacturer_id: manufacturer.id,
      description: partData.description,
      datasheet_url: partData.datasheet_url,
      lifecycle_status: (partData.lifecycle_status || 'Unknown') as LifecycleStatus,
      specs: partData.specs,
      pin_count: pinCount,
      data_sources: result.dataSources as DataSource[],
      confidence_score: calculateConfidence(result.dataSources, extractedPinouts.length)
    });

    result.componentId = component.id;

    // Step 6: Save pinouts if extracted
    if (extractedPinouts.length > 0) {
      console.log(`[Ingestion] Saving ${extractedPinouts.length} pinouts...`);
      await upsertPinouts(
        component.id,
        extractedPinouts.map(p => ({
          pin_number: p.pin_number,
          pin_name: p.pin_name,
          pin_function: mapToPinFunction(p.pin_function),
          source: 'pdf' as DataSource,
          confidence: p.confidence
        }))
      );
      result.pinoutsExtracted = extractedPinouts.length;
    }

    result.success = true;
    console.log(`[Ingestion] Import complete for ${mpn}`);

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Ingestion] Import failed for ${mpn}:`, err);
    return result;
  }
}

export async function importPartsBatch(
  mpns: string[],
  options: ImportOptions = {}
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const mpn of mpns) {
    const result = await importPartByMpn(mpn, options);
    results.push(result);

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

function calculateConfidence(dataSources: string[], pinoutCount: number): number {
  let score = 0.5; // Base score

  // Add points for each data source
  if (dataSources.includes('nexar')) score += 0.2;
  if (dataSources.includes('digikey')) score += 0.2;

  // Add points for pinout extraction
  if (dataSources.includes('pdf') && pinoutCount > 0) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}
