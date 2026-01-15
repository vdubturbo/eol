import OpenAI from 'openai';
import { trackApiUsage } from '../db/queries';
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

const PINOUT_EXTRACTION_PROMPT = `You are an expert at extracting pinout information from electronic component datasheets.

Given the following text from a datasheet, extract the pinout information.

For each pin, provide:
- pin_number: The pin number (integer)
- pin_name: The pin name (e.g., VIN, GND, EN)
- pin_function: One of these categories:
  - INPUT_VOLTAGE: Power input pins (VIN, VCC, VBAT)
  - OUTPUT_VOLTAGE: Power output pins (VOUT, SW for regulators)
  - GROUND: Ground pins (GND, PGND, AGND)
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

Respond with valid JSON only, no explanation. Format:
{
  "pinouts": [
    {"pin_number": 1, "pin_name": "BOOT", "pin_function": "BOOTSTRAP", "confidence": 0.95},
    ...
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
  datasheetText: string
): Promise<ExtractedPinout[]> {
  const client = getClient();

  // Truncate if too long
  const maxLength = 15000;
  const truncatedText = datasheetText.length > maxLength
    ? datasheetText.substring(0, maxLength) + '\n...[truncated]'
    : datasheetText;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: PINOUT_EXTRACTION_PROMPT
      },
      {
        role: 'user',
        content: `Datasheet text:\n${truncatedText}`
      }
    ],
    response_format: { type: 'json_object' }
  });

  // Track usage
  await trackApiUsage('openai', {
    endpoint: 'chat/completions',
    tokens_used: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    estimated_cost: calculateOpenAICost(response.usage)
  });

  // Parse response
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response content');
  }

  try {
    const parsed = JSON.parse(content);
    return parsed.pinouts || [];
  } catch {
    console.error('Failed to parse LLM response:', content);
    return [];
  }
}

export async function extractSpecsWithLLM(
  datasheetText: string
): Promise<ExtractedSpecs> {
  const client = getClient();

  // Truncate if too long
  const maxLength = 15000;
  const truncatedText = datasheetText.length > maxLength
    ? datasheetText.substring(0, maxLength) + '\n...[truncated]'
    : datasheetText;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: SPECS_EXTRACTION_PROMPT
      },
      {
        role: 'user',
        content: `Datasheet text:\n${truncatedText}`
      }
    ],
    response_format: { type: 'json_object' }
  });

  await trackApiUsage('openai', {
    endpoint: 'chat/completions',
    tokens_used: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    estimated_cost: calculateOpenAICost(response.usage)
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response content');
  }

  try {
    const parsed = JSON.parse(content);
    return parsed.specs || {};
  } catch {
    console.error('Failed to parse LLM response:', content);
    return {};
  }
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
  };

  return mapping[functionString] || 'OTHER';
}
