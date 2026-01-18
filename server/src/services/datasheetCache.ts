import { supabaseAdmin } from '../db/supabase';
import { extractFromUrl } from './pdfExtractor';
import { getPrompt, renderTemplate, logPromptExecution } from './promptService';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PackagePinout {
  pins: Array<{
    pin_number: number;
    pin_name: string;
    pin_function: string;
    confidence?: number;
  }>;
  aliases: string[];
  suffix_hints: string[];
}

export interface DatasheetExtraction {
  id?: string;
  pinouts_by_package: Record<string, PackagePinout>;
  specs: Record<string, unknown>;
  page_count: number;
  text_length: number;
}

export async function getOrExtractDatasheet(
  datasheetUrl: string,
  mpnHint?: string
): Promise<DatasheetExtraction | null> {
  if (!datasheetUrl) return null;

  // Normalize URL for matching
  const normalizedUrl = normalizeDatasheetUrl(datasheetUrl);

  // Check cache first
  const { data: cached } = await supabaseAdmin
    .from('datasheet_cache')
    .select('*')
    .eq('datasheet_url', normalizedUrl)
    .eq('status', 'completed')
    .single();

  if (cached) {
    console.log(`[DatasheetCache] HIT for ${normalizedUrl.slice(0, 60)}...`);
    return {
      id: cached.id,
      pinouts_by_package: cached.pinouts_by_package || {},
      specs: cached.specs || {},
      page_count: cached.page_count || 0,
      text_length: cached.text_length || 0
    };
  }

  // Check if already processing
  const { data: processing } = await supabaseAdmin
    .from('datasheet_cache')
    .select('id')
    .eq('datasheet_url', normalizedUrl)
    .eq('status', 'processing')
    .single();

  if (processing) {
    console.log(`[DatasheetCache] Already processing ${normalizedUrl.slice(0, 60)}..., skipping`);
    return null;
  }

  // Create cache entry
  const { data: cacheEntry, error: insertError } = await supabaseAdmin
    .from('datasheet_cache')
    .insert({
      datasheet_url: normalizedUrl,
      status: 'processing'
    })
    .select()
    .single();

  if (insertError) {
    // Might be a race condition - another process created it
    if (insertError.code === '23505') {
      console.log(`[DatasheetCache] Entry already exists, skipping`);
      return null;
    }
    console.error(`[DatasheetCache] Failed to create entry:`, insertError);
    return null;
  }

  try {
    console.log(`[DatasheetCache] MISS - extracting ${normalizedUrl.slice(0, 60)}...`);

    // Download and extract PDF
    const pdfData = await extractFromUrl(datasheetUrl);

    // Use multi-pinout extraction prompt
    const extraction = await extractAllPinouts(pdfData.text, mpnHint);

    // Update cache with results
    await supabaseAdmin
      .from('datasheet_cache')
      .update({
        raw_text: pdfData.text.slice(0, 50000), // Truncate for storage
        text_length: pdfData.text.length,
        page_count: pdfData.pages,
        pinouts_by_package: extraction.pinouts_by_package,
        specs: extraction.specs,
        extraction_model: 'gpt-4o-mini',
        extraction_tokens: extraction.tokens,
        extraction_cost: extraction.cost,
        status: 'completed'
      })
      .eq('id', cacheEntry.id);

    console.log(`[DatasheetCache] Extracted ${Object.keys(extraction.pinouts_by_package).length} package variants`);

    return {
      id: cacheEntry.id,
      pinouts_by_package: extraction.pinouts_by_package,
      specs: extraction.specs,
      page_count: pdfData.pages,
      text_length: pdfData.text.length
    };

  } catch (error) {
    console.error(`[DatasheetCache] Extraction failed:`, error);

    await supabaseAdmin
      .from('datasheet_cache')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', cacheEntry.id);

    return null;
  }
}

async function extractAllPinouts(
  datasheetText: string,
  mpnHint?: string
): Promise<{
  pinouts_by_package: Record<string, PackagePinout>;
  specs: Record<string, unknown>;
  tokens: number;
  cost: number;
}> {
  const startTime = Date.now();

  // Get multi-pinout prompt from database
  const prompt = await getPrompt('multi_pinout_extraction');

  // Fall back to hardcoded prompt if not in DB
  const systemPrompt = prompt?.system_prompt ||
    'You are an expert electronics engineer analyzing component datasheets. This datasheet covers MULTIPLE package variants with DIFFERENT pinouts. Extract ALL of them.';

  const userPromptTemplate = prompt?.user_prompt_template ||
    `This datasheet covers multiple package variants. Extract the pinout for EACH package variant shown.

Component family: {{mpn_base}}

Return a JSON object with ALL package variants:
{
  "packages": {
    "SOT-223": {
      "pins": [
        {"pin_number": 1, "pin_name": "INPUT", "pin_function": "INPUT_VOLTAGE"},
        {"pin_number": 2, "pin_name": "OUTPUT", "pin_function": "OUTPUT_VOLTAGE"},
        {"pin_number": 3, "pin_name": "ADJ/GND", "pin_function": "GROUND"}
      ],
      "aliases": ["SOT223", "SOT-223-4"],
      "suffix_hints": ["H"]
    }
  },
  "specs": {
    "vin_max": 15,
    "vout_min": 1.25
  },
  "notes": "Any relevant notes"
}

IMPORTANT: Different packages often have DIFFERENT pin assignments even for the same part family!

Datasheet text:
{{datasheet_text}}`;

  const mpnBase = mpnHint?.replace(/[A-Z]\d?-[\d.]+.*$/i, '') || 'unknown';

  const userPrompt = renderTemplate(userPromptTemplate, {
    mpn_base: mpnBase,
    datasheet_text: datasheetText.slice(0, 20000) // More context for multi-package
  });

  const model = prompt?.model || 'gpt-4o-mini';
  const temperature = prompt?.temperature || 0.1;
  const maxTokens = prompt?.max_tokens || 4000;

  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content || '';
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = (inputTokens / 1000) * 0.00015 + (outputTokens / 1000) * 0.0006;

  // Log execution if using DB prompt
  if (prompt) {
    await logPromptExecution({
      promptName: prompt.name,
      promptId: prompt.id,
      inputVariables: { mpn_base: mpnBase },
      renderedPrompt: userPrompt.slice(0, 5000),
      responseRaw: content,
      responseParsed: null,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      componentMpn: mpnHint,
      success: true
    });
  }

  // Parse response
  try {
    const parsed = JSON.parse(content);
    return {
      pinouts_by_package: parsed.packages || {},
      specs: parsed.specs || {},
      tokens: inputTokens + outputTokens,
      cost
    };
  } catch (err) {
    console.error('[DatasheetCache] Failed to parse LLM response:', err);
    return {
      pinouts_by_package: {},
      specs: {},
      tokens: inputTokens + outputTokens,
      cost
    };
  }
}

export function matchPinoutToComponent(
  extraction: DatasheetExtraction,
  packageNormalized: string | undefined,
  mpnSuffix: string | null
): PackagePinout | null {
  const packages = extraction.pinouts_by_package;

  if (!packages || Object.keys(packages).length === 0) return null;

  // Strategy 1: Match by MPN suffix
  if (mpnSuffix) {
    for (const [pkg, pinout] of Object.entries(packages)) {
      if (pinout.suffix_hints?.some(s =>
        s.toUpperCase() === mpnSuffix.toUpperCase()
      )) {
        console.log(`[PinoutMatch] Matched by suffix "${mpnSuffix}" -> ${pkg}`);
        return pinout;
      }
    }
  }

  // Strategy 2: Match by package name
  if (packageNormalized) {
    // Direct match
    if (packages[packageNormalized]) {
      console.log(`[PinoutMatch] Direct match -> ${packageNormalized}`);
      return packages[packageNormalized];
    }

    // Check aliases
    for (const [pkg, pinout] of Object.entries(packages)) {
      if (pinout.aliases?.some(a =>
        normalizeForComparison(a) === normalizeForComparison(packageNormalized)
      )) {
        console.log(`[PinoutMatch] Alias match -> ${pkg}`);
        return pinout;
      }
    }

    // Fuzzy match (SOT-223 ~= SOT223)
    const normalizedSearch = normalizeForComparison(packageNormalized);
    for (const [pkg, pinout] of Object.entries(packages)) {
      if (normalizeForComparison(pkg) === normalizedSearch) {
        console.log(`[PinoutMatch] Fuzzy match -> ${pkg}`);
        return pinout;
      }
    }
  }

  // Strategy 3: Return first one as fallback (log warning)
  const firstKey = Object.keys(packages)[0];
  console.warn(`[PinoutMatch] No match found for package="${packageNormalized}", suffix="${mpnSuffix}", using fallback: ${firstKey}`);
  return packages[firstKey];
}

function normalizeForComparison(s: string): string {
  return s.toUpperCase().replace(/[-\s]/g, '');
}

function normalizeDatasheetUrl(url: string): string {
  // Remove tracking parameters and normalize
  try {
    const parsed = new URL(url);
    // Remove common tracking params
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    return parsed.toString();
  } catch {
    return url;
  }
}

// Helper to extract MPN suffix for package matching
export function extractMpnSuffix(mpn: string): string | null {
  // Extract suffix that indicates package variant
  // AZ1117CH-3.3TRG1 -> "H"
  // AZ1117CR-3.3TRG1 -> "R"
  // AZ1117CR2-3.3TRG1 -> "R2"

  // Pattern: letters + numbers + letters + SUFFIX + dash + voltage
  const match = mpn.match(/[A-Z]+\d+[A-Z]*([A-Z]\d?)-/i);
  if (match) return match[1];

  // Try other patterns
  const suffixMatch = mpn.match(/-([A-Z]\d?)[A-Z]*-?\d/i);
  if (suffixMatch) return suffixMatch[1];

  return null;
}

// Admin function to get cache stats
export async function getCacheStats(): Promise<{
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
}> {
  const { data } = await supabaseAdmin
    .from('datasheet_cache')
    .select('status');

  const stats = {
    total: 0,
    completed: 0,
    failed: 0,
    processing: 0,
    pending: 0
  };

  data?.forEach(row => {
    stats.total++;
    stats[row.status as keyof typeof stats]++;
  });

  return stats;
}
