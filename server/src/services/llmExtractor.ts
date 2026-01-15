import Anthropic from '@anthropic-ai/sdk';
import { trackApiUsage } from '../db/queries';
import type { ExtractedPinout, ExtractedSpecs, PinFunction } from '../types';

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
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
}

Datasheet text:
`;

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
}

Datasheet text:
`;

export async function extractPinoutsWithLLM(
  datasheetText: string
): Promise<ExtractedPinout[]> {
  const client = getClient();

  // Truncate if too long
  const maxLength = 15000;
  const truncatedText = datasheetText.length > maxLength
    ? datasheetText.substring(0, maxLength) + '\n...[truncated]'
    : datasheetText;

  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: PINOUT_EXTRACTION_PROMPT + truncatedText
      }
    ]
  });

  // Track usage
  await trackApiUsage('anthropic', {
    endpoint: 'messages',
    tokens_used: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    estimated_cost: calculateAnthropicCost(response.usage)
  });

  // Parse response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    const parsed = JSON.parse(content.text);
    return parsed.pinouts || [];
  } catch {
    console.error('Failed to parse LLM response:', content.text);
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

  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: SPECS_EXTRACTION_PROMPT + truncatedText
      }
    ]
  });

  await trackApiUsage('anthropic', {
    endpoint: 'messages',
    tokens_used: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    estimated_cost: calculateAnthropicCost(response.usage)
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    const parsed = JSON.parse(content.text);
    return parsed.specs || {};
  } catch {
    console.error('Failed to parse LLM response:', content.text);
    return {};
  }
}

function calculateAnthropicCost(usage?: { input_tokens?: number; output_tokens?: number }): number {
  if (!usage) return 0;

  // Claude 3 Haiku pricing (as of 2024)
  const inputCostPer1k = 0.00025;
  const outputCostPer1k = 0.00125;

  const inputCost = ((usage.input_tokens || 0) / 1000) * inputCostPer1k;
  const outputCost = ((usage.output_tokens || 0) / 1000) * outputCostPer1k;

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
