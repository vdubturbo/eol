import pdf from 'pdf-parse';

export interface ExtractedPDFData {
  text: string;
  pages: number;
  metadata: Record<string, unknown>;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedPDFData> {
  try {
    const data = await pdf(buffer);

    return {
      text: data.text,
      pages: data.numpages,
      metadata: {
        info: data.info,
        version: data.version
      }
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

export async function extractFromUrl(url: string): Promise<ExtractedPDFData> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return extractTextFromPDF(buffer);
  } catch (error) {
    console.error('PDF fetch error:', error);
    throw new Error(`Failed to fetch PDF from URL: ${url}`);
  }
}

// Extract pinout table from text using regex patterns
export function extractPinoutFromText(text: string): Array<{
  pin_number: number;
  pin_name: string;
  description: string;
}> {
  const pinouts: Array<{
    pin_number: number;
    pin_name: string;
    description: string;
  }> = [];

  // Common patterns for pinout tables
  // Pattern 1: "Pin 1 - VIN - Input Voltage"
  const pattern1 = /(?:pin\s*)?(\d+)\s*[-–]\s*(\w+)\s*[-–]\s*([^\n]+)/gi;

  // Pattern 2: Table format "1 | VIN | Input Voltage"
  const pattern2 = /(\d+)\s*\|\s*(\w+)\s*\|\s*([^\n|]+)/g;

  // Pattern 3: Simple "1. VIN (Input Voltage)"
  const pattern3 = /(\d+)\.\s*(\w+)\s*\(([^)]+)\)/g;

  let match: RegExpExecArray | null;

  // Try pattern 1
  while ((match = pattern1.exec(text)) !== null) {
    pinouts.push({
      pin_number: parseInt(match[1]),
      pin_name: match[2].toUpperCase(),
      description: match[3].trim()
    });
  }

  // If no matches, try pattern 2
  if (pinouts.length === 0) {
    while ((match = pattern2.exec(text)) !== null) {
      pinouts.push({
        pin_number: parseInt(match[1]),
        pin_name: match[2].toUpperCase(),
        description: match[3].trim()
      });
    }
  }

  // If still no matches, try pattern 3
  if (pinouts.length === 0) {
    while ((match = pattern3.exec(text)) !== null) {
      pinouts.push({
        pin_number: parseInt(match[1]),
        pin_name: match[2].toUpperCase(),
        description: match[3].trim()
      });
    }
  }

  return pinouts;
}

// Extract specifications from text
export function extractSpecsFromText(text: string): Record<string, unknown> {
  const specs: Record<string, unknown> = {};

  // Common spec patterns
  const patterns: Array<{ key: string; pattern: RegExp }> = [
    { key: 'vin_min', pattern: /input\s*voltage[^:]*:\s*([\d.]+)\s*V?\s*(?:to|-|–)/i },
    { key: 'vin_max', pattern: /input\s*voltage[^:]*:\s*[\d.]+\s*V?\s*(?:to|-|–)\s*([\d.]+)/i },
    { key: 'vout_min', pattern: /output\s*voltage[^:]*:\s*([\d.]+)\s*V?\s*(?:to|-|–)/i },
    { key: 'vout_max', pattern: /output\s*voltage[^:]*:\s*[\d.]+\s*V?\s*(?:to|-|–)\s*([\d.]+)/i },
    { key: 'iout_max', pattern: /(?:output\s*current|maximum\s*current)[^:]*:\s*([\d.]+)\s*A/i },
    { key: 'switching_freq', pattern: /switching\s*frequency[^:]*:\s*([\d.]+)\s*(?:k)?Hz/i },
    { key: 'efficiency', pattern: /efficiency[^:]*:\s*([\d.]+)\s*%/i },
    { key: 'operating_temp_min', pattern: /operating\s*temp[^:]*:\s*(-?[\d.]+)\s*°?C?\s*(?:to|-|–)/i },
    { key: 'operating_temp_max', pattern: /operating\s*temp[^:]*:\s*-?[\d.]+\s*°?C?\s*(?:to|-|–)\s*(-?[\d.]+)/i },
  ];

  for (const { key, pattern } of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);

      // Handle kHz to Hz conversion
      if (key === 'switching_freq' && text.toLowerCase().includes('khz')) {
        value *= 1000;
      }

      specs[key] = value;
    }
  }

  return specs;
}
