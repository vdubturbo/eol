import { supabaseAdmin } from '../db/supabase';
import { getPartByMpn as getNexarPart, normalizeNexarPart } from './nexar';
import { getPartByMpn as getDigiKeyPart, normalizeDigiKeyPart, searchParts as searchDigiKeyParts } from './digikey';
import { extractFromUrl } from './pdfExtractor';
import { extractPinoutsWithLLM, extractSpecsWithLLM, mapToPinFunction } from './llmExtractor';
import { getOrExtractDatasheet, matchPinoutToComponent } from './datasheetCache';
import { upsertComponent, upsertPinouts, getOrCreateManufacturer } from '../db/queries';
import type { ExtractedPinout, DataSource, LifecycleStatus } from '../types';

// Helper to extract error message from various error types
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;
    // Supabase errors have message, code, details properties
    if (errObj.message) {
      const parts = [errObj.message as string];
      if (errObj.code) parts.push(`(code: ${errObj.code})`);
      if (errObj.details) parts.push(`- ${errObj.details}`);
      return parts.join(' ');
    }
    // Try to stringify if has toString
    if (errObj.toString && errObj.toString !== Object.prototype.toString) {
      return errObj.toString();
    }
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'Unknown error';
}

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
  skipExisting?: boolean;
  sources?: ('nexar' | 'digikey')[];
}

// Check if a part already exists in the database (case-insensitive)
async function checkPartExists(mpn: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('components')
    .select('id')
    .ilike('mpn', mpn)
    .limit(1)
    .single();
  
  return !!data;
}

export async function importPartByMpn(
  mpn: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const {
    extractPinouts = true,
    skipExisting = true,
    sources = ['nexar', 'digikey']
  } = options;

  const result: ImportResult = {
    success: false,
    mpn,
    dataSources: [],
    pinoutsExtracted: 0
  };

  try {
    // Check if part already exists
    if (skipExisting) {
      const exists = await checkPartExists(mpn);
      if (exists) {
        console.log(`[Ingestion] Skipping ${mpn} - already exists`);
        result.success = true;
        result.error = 'Skipped - already exists';
        return result;
      }
    }

    console.log(`[Ingestion] Starting import for MPN: ${mpn}`);

    // Step 1: Lookup part from API sources
    let partData: {
      mpn: string;
      manufacturer: string;
      description: string;
      datasheet_url?: string;
      lifecycle_status?: string;
      package_raw?: string;
      package_normalized?: string;
      package_source?: 'api_params' | 'api_description' | 'datasheet' | 'manual';
      mpn_suffix?: string | null;
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
    let datasheetCacheId: string | undefined;
    let pinoutSource: 'datasheet_cache' | 'direct_extraction' | undefined;

    if (extractPinouts && partData.datasheet_url) {
      try {
        console.log(`[Ingestion] Checking datasheet cache for: ${partData.datasheet_url.slice(0, 60)}...`);

        // Try datasheet cache first (shared across package variants)
        const extraction = await getOrExtractDatasheet(partData.datasheet_url, partData.mpn);

        if (extraction) {
          datasheetCacheId = extraction.id;
          console.log(`[Ingestion] Found ${Object.keys(extraction.pinouts_by_package).length} package variants in cache`);

          // Match pinout to this specific component's package
          const matchedPinout = matchPinoutToComponent(
            extraction,
            partData.package_normalized,
            partData.mpn_suffix || null
          );

          if (matchedPinout) {
            extractedPinouts = matchedPinout.pins.map(p => ({
              pin_number: p.pin_number,
              pin_name: p.pin_name,
              pin_function: p.pin_function,
              confidence: p.confidence || 0.8
            }));
            pinoutSource = 'datasheet_cache';
            result.dataSources.push('pdf');
            console.log(`[Ingestion] Matched ${extractedPinouts.length} pinouts from cache`);
          }

          // Merge cached specs if we don't have them
          if (Object.keys(partData.specs).length === 0 && extraction.specs) {
            partData.specs = { ...partData.specs, ...extraction.specs };
          }
        }

        // Fallback to direct extraction if cache didn't provide pinouts
        if (extractedPinouts.length === 0) {
          console.log(`[Ingestion] Cache miss or no match, falling back to direct extraction...`);
          const pdfData = await extractFromUrl(partData.datasheet_url);
          console.log(`[Ingestion] PDF extracted: ${pdfData.pages} pages, ${pdfData.text.length} chars`);

          console.log(`[Ingestion] Running LLM extraction...`);
          extractedPinouts = await extractPinoutsWithLLM(pdfData.text);
          pinoutSource = 'direct_extraction';
          result.dataSources.push('pdf');
          console.log(`[Ingestion] Extracted ${extractedPinouts.length} pinouts directly`);

          // Also extract specs if not already present
          if (Object.keys(partData.specs).length === 0) {
            const extractedSpecs = await extractSpecsWithLLM(pdfData.text);
            partData.specs = { ...partData.specs, ...extractedSpecs };
          }
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
    console.log(`[Ingestion] Package: raw="${partData.package_raw}" normalized="${partData.package_normalized}" source="${partData.package_source}" suffix="${partData.mpn_suffix}"`);
    const component = await upsertComponent({
      mpn: partData.mpn,
      manufacturer_id: manufacturer.id,
      description: partData.description,
      datasheet_url: partData.datasheet_url,
      lifecycle_status: (partData.lifecycle_status || 'Unknown') as LifecycleStatus,
      package_raw: partData.package_raw,
      package_normalized: partData.package_normalized,
      package_source: partData.package_source || null,
      mpn_suffix: partData.mpn_suffix || null,
      pinout_source: pinoutSource || null,
      datasheet_cache_id: datasheetCacheId || null,
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
    result.error = getErrorMessage(err);
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

// Check if a component already exists by MPN (case-insensitive)
async function componentExistsByMpn(mpn: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('components')
    .select('id')
    .ilike('mpn', mpn)
    .limit(1)
    .single();
  
  return !!data;
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

// Part Family Import
export interface PartFamilyResult {
  baseMpn: string;
  variantsFound: number;
  imported: number;
  skipped: number;
  errors: string[];
  variants: string[];
}

export async function importPartFamily(
  baseMpn: string,
  options: ImportOptions & { skipExisting?: boolean } = {}
): Promise<PartFamilyResult> {
  const { skipExisting = true } = options;
  
  const result: PartFamilyResult = {
    baseMpn,
    variantsFound: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    variants: []
  };

  try {
    console.log(`[Ingestion] Searching for variants of: ${baseMpn}`);

    // Use DigiKey keyword search to find all variants
    const searchResults = await searchDigiKeyParts(baseMpn, 100);

    if (!searchResults || searchResults.length === 0) {
      result.errors.push(`No variants found for ${baseMpn}`);
      return result;
    }

    // Filter to only MPNs that start with the base part number
    const variants = searchResults
      .map(part => {
        const normalized = normalizeDigiKeyPart(part);
        return normalized.mpn?.trim();
      })
      .filter((mpn): mpn is string => !!mpn && mpn.toUpperCase().startsWith(baseMpn.toUpperCase()));

    // Dedupe (case-insensitive)
    const seen = new Set<string>();
    const uniqueVariants: string[] = [];
    for (const mpn of variants) {
      const key = mpn.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueVariants.push(mpn);
      }
    }

    result.variantsFound = uniqueVariants.length;
    result.variants = uniqueVariants;

    console.log(`[Ingestion] Found ${uniqueVariants.length} variants for ${baseMpn}`);

    // Track what we've imported in this batch to avoid duplicates
    const importedInBatch = new Set<string>();

    // Import each variant
    for (const mpn of uniqueVariants) {
      // Skip if already imported in this batch
      if (importedInBatch.has(mpn.toUpperCase())) {
        console.log(`[Ingestion] Skipping ${mpn} (duplicate in batch)`);
        continue;
      }

      try {
        // Check if already exists
        if (skipExisting) {
          const exists = await componentExistsByMpn(mpn);
          if (exists) {
            result.skipped++;
            console.log(`[Ingestion] Skipping ${mpn} (already exists)`);
            continue;
          }
        }
        
        const importResult = await importPartByMpn(mpn, { ...options, skipExisting: false }); // Already checked above
        if (importResult.success) {
          result.imported++;
          importedInBatch.add(mpn.toUpperCase());
        } else {
          result.errors.push(`${mpn}: ${importResult.error || 'Import failed'}`);
        }
      } catch (err) {
        const errMsg = getErrorMessage(err);
        // Handle duplicate key errors gracefully
        if (errMsg.includes('21000') || errMsg.includes('duplicate') || errMsg.includes('second time')) {
          console.log(`[Ingestion] Skipping ${mpn} (duplicate in transaction)`);
          result.skipped++;
        } else {
          result.errors.push(`${mpn}: ${errMsg}`);
        }
      }

      // Delay between imports to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[Ingestion] Family import complete: ${result.imported}/${result.variantsFound} imported`);

    return result;
  } catch (err) {
    result.errors.push(getErrorMessage(err));
    console.error(`[Ingestion] Family import failed for ${baseMpn}:`, err);
    return result;
  }
}
