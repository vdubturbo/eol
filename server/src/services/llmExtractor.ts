import OpenAI from 'openai';
import { trackApiUsage } from '../db/queries';
import { getPrompt, renderTemplate, logPromptExecution } from './promptService';
import type { ExtractedPinout, ExtractedSpecs, PinFunction } from '../types';

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// Fallback prompts if database prompts aren't available
const PINOUT_EXTRACTION_PROMPT = `You are an expert at extracting pinout information from electronic component datasheets.

Given the following text from a datasheet, extract the pinout information.

For each pin, provide:
- pin_number: The pin number (integer)
- pin_name: The pin name (e.g., VIN, GND, EN, ADJ)
- pin_function: One of these categories:
  - INPUT_VOLTAGE: Power input pins (VIN, VCC, VBAT, INPUT)
  - OUTPUT_VOLTAGE: Power output pins (VOUT, SW for regulators, OUTPUT)
  - GROUND: Ground pins (GND, PGND, AGND)
  - ADJUST: Voltage adjust pins (ADJ, ADJUST) - used on adjustable regulators like LM317
  - ENABLE: Enable/shutdown pins (EN, SHDN, ON)
  - FEEDBACK: Feedback pins (FB, VSNS, VSENSE)
  - BOOTSTRAP: Bootstrap pins (BOOT, BST)
  - SWITCH_NODE: Switching node pins (SW, PH, LX)
  - COMPENSATION: Compensation pins (COMP, VC)
  - SOFT_START: Soft start pins (SS, SSTART)
  - POWER_GOOD: Power good indicator pins (PG, PGOOD)
  - FREQUENCY: Frequency setting pins (FREQ, RT)
  - SYNC: Sync/clock pins (SYNC, CLK)
  - NC: No connect pins (NC, N.C.)
  - OTHER: Any other function
- confidence: Your confidence in this extraction (0.0 to 1.0)

IMPORTANT: For adjustable voltage regulators like LM317, LM317A, LM117:
- Pin 1 is typically ADJUST (sets output voltage via resistor divider)
- Pin 2 is typically OUTPUT (regulated output voltage)
- Pin 3 is typically INPUT (unregulated input voltage)

Respond with valid JSON only, no explanation. Format:
{
  "pinouts": [
    {"pin_number": 1, "pin_name": "ADJUST", "pin_function": "ADJUST", "confidence": 0.95},
    {"pin_number": 2, "pin_name": "OUTPUT", "pin_function": "OUTPUT_VOLTAGE", "confidence": 0.95},
    {"pin_number": 3, "pin_name": "INPUT", "pin_function": "INPUT_VOLTAGE", "confidence": 0.95}
  ]
}`;

const SPECS_EXTRACTION_PROMPT = `You are an expert at extracting electrical specifications from electronic component datasheets.

Given the following text from a datasheet, extract key electrical specifications.

Extract these values if present (use numbers only, no units):
- vin_min: Minimum input voltage (V)
- vin_max: Maximum input voltage (V)
- vout_min: Minimum output voltage (V)
- vout_max: Maximum output voltage (V)
- iout_max: Maximum output current (A)
- switching_freq_min: Minimum switching frequency (Hz)
- switching_freq_max: Maximum switching frequency (Hz)
- efficiency: Peak efficiency (as decimal, e.g., 0.92 for 92%)
- operating_temp_min: Minimum operating temperature (°C)
- operating_temp_max: Maximum operating temperature (°C)

Respond with valid JSON only, no explanation. Only include fields you can confidently extract.
Format:
{
  "specs": {
    "vin_min": 4.5,
    "vin_max": 28,
    ...
  },
  "confidence": 0.9
}`;

export async function extractPinoutsWithLLM(
  datasheetText: string,
  mpn?: string,
  packageType?: string
): Promise<ExtractedPinout[]> {
  const client = getClient();
  const startTime = Date.now();

  // Truncate if too long
  const maxLength = 15000;
  const truncatedText = datasheetText.length > maxLength
    ? datasheetText.substring(0, maxLength) + '\n...[truncated]'
    : datasheetText;

  // Try to get prompt from database
  const dbPrompt = await getPrompt('pinout_extraction');

  let systemPrompt: string;
  let userPrompt: string;
  let model = 'gpt-4o-mini';
  let maxTokens = 2000;
  let temperature = 0.1;

  if (dbPrompt) {
    systemPrompt = dbPrompt.system_prompt;
    userPrompt = renderTemplate(dbPrompt.user_prompt_template, {
      mpn: mpn || 'unknown',
      package_type: packageType || 'unknown',
      datasheet_text: truncatedText
    });
    model = dbPrompt.model;
    maxTokens = dbPrompt.max_tokens;
    temperature = dbPrompt.temperature;
  } else {
    // Fallback to hardcoded prompts
    systemPrompt = PINOUT_EXTRACTION_PROMPT;
    userPrompt = `Datasheet text:\n${truncatedText}`;
  }

  let response;
  let content = '';
  let parsed: unknown = null;
  let success = true;
  let errorMessage: string | undefined;

  try {
    response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    // Track usage
    await trackApiUsage('openai', {
      endpoint: 'chat/completions',
      tokens_used: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
      estimated_cost: calculateOpenAICost(response.usage)
    });

    content = response.choices[0]?.message?.content || '';
    if (!content) {
      throw new Error('No response content');
    }

    parsed = JSON.parse(content);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to extract pinouts:', errorMessage);
  }

  // Log execution if using database prompt
  if (dbPrompt) {
    await logPromptExecution({
      promptName: 'pinout_extraction',
      promptId: dbPrompt.id,
      inputVariables: { mpn: mpn || 'unknown', package_type: packageType || 'unknown' },
      renderedPrompt: userPrompt,
      responseRaw: content,
      responseParsed: parsed,
      inputTokens: response?.usage?.prompt_tokens || 0,
      outputTokens: response?.usage?.completion_tokens || 0,
      latencyMs: Date.now() - startTime,
      componentMpn: mpn,
      success,
      errorMessage
    });
  }

  if (!success || !parsed) {
    return [];
  }

  return (parsed as { pinouts?: ExtractedPinout[] }).pinouts || (parsed as { pins?: ExtractedPinout[] }).pins || [];
}

export async function extractSpecsWithLLM(
  datasheetText: string,
  mpn?: string
): Promise<ExtractedSpecs> {
  const client = getClient();
  const startTime = Date.now();

  // Truncate if too long
  const maxLength = 15000;
  const truncatedText = datasheetText.length > maxLength
    ? datasheetText.substring(0, maxLength) + '\n...[truncated]'
    : datasheetText;

  // Try to get prompt from database
  const dbPrompt = await getPrompt('specs_extraction');

  let systemPrompt: string;
  let userPrompt: string;
  let model = 'gpt-4o-mini';
  let maxTokens = 1500;
  let temperature = 0.1;

  if (dbPrompt) {
    systemPrompt = dbPrompt.system_prompt;
    userPrompt = renderTemplate(dbPrompt.user_prompt_template, {
      mpn: mpn || 'unknown',
      datasheet_text: truncatedText
    });
    model = dbPrompt.model;
    maxTokens = dbPrompt.max_tokens;
    temperature = dbPrompt.temperature;
  } else {
    // Fallback to hardcoded prompts
    systemPrompt = SPECS_EXTRACTION_PROMPT;
    userPrompt = `Datasheet text:\n${truncatedText}`;
  }

  let response;
  let content = '';
  let parsed: unknown = null;
  let success = true;
  let errorMessage: string | undefined;

  try {
    response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    await trackApiUsage('openai', {
      endpoint: 'chat/completions',
      tokens_used: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
      estimated_cost: calculateOpenAICost(response.usage)
    });

    content = response.choices[0]?.message?.content || '';
    if (!content) {
      throw new Error('No response content');
    }

    parsed = JSON.parse(content);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to extract specs:', errorMessage);
  }

  // Log execution if using database prompt
  if (dbPrompt) {
    await logPromptExecution({
      promptName: 'specs_extraction',
      promptId: dbPrompt.id,
      inputVariables: { mpn: mpn || 'unknown' },
      renderedPrompt: userPrompt,
      responseRaw: content,
      responseParsed: parsed,
      inputTokens: response?.usage?.prompt_tokens || 0,
      outputTokens: response?.usage?.completion_tokens || 0,
      latencyMs: Date.now() - startTime,
      componentMpn: mpn,
      success,
      errorMessage
    });
  }

  if (!success || !parsed) {
    return {};
  }

  return (parsed as { specs?: ExtractedSpecs }).specs || {};
}

function calculateOpenAICost(usage?: { prompt_tokens?: number; completion_tokens?: number }): number {
  if (!usage) return 0;

  // GPT-4o-mini pricing (as of 2024)
  const inputCostPer1k = 0.00015;
  const outputCostPer1k = 0.0006;

  const inputCost = ((usage.prompt_tokens || 0) / 1000) * inputCostPer1k;
  const outputCost = ((usage.completion_tokens || 0) / 1000) * outputCostPer1k;

  return inputCost + outputCost;
}

export function mapToPinFunction(functionString: string): PinFunction {
  const mapping: Record<string, PinFunction> = {
    'INPUT_VOLTAGE': 'INPUT_VOLTAGE',
    'OUTPUT_VOLTAGE': 'OUTPUT_VOLTAGE',
    'GROUND': 'GROUND',
    'ENABLE': 'ENABLE',
    'FEEDBACK': 'FEEDBACK',
    'BOOTSTRAP': 'BOOTSTRAP',
    'SWITCH_NODE': 'SWITCH_NODE',
    'COMPENSATION': 'COMPENSATION',
    'SOFT_START': 'SOFT_START',
    'POWER_GOOD': 'POWER_GOOD',
    'FREQUENCY': 'FREQUENCY',
    'SYNC': 'SYNC',
    'NC': 'NC',
    'ADJUST': 'ADJUST',
  };

  return mapping[functionString] || 'OTHER';
}
