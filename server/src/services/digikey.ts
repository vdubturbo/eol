import { trackApiUsage } from '../db/queries';
import type { DigiKeyPart } from '../types';

const DIGIKEY_API_URL = 'https://api.digikey.com/products/v4';

// Token management
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.DIGIKEY_CLIENT_ID;
  const clientSecret = process.env.DIGIKEY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('DigiKey credentials not configured');
  }

  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  // Get new token
  const response = await fetch('https://api.digikey.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get DigiKey token: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  return accessToken!;
}

export async function searchParts(query: string, limit = 20): Promise<DigiKeyPart[]> {
  const token = await getAccessToken();

  const response = await fetch(`${DIGIKEY_API_URL}/search/keyword`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Keywords: query,
      RecordCount: limit,
      RecordStartPosition: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`DigiKey search failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.Products || [];

  await trackApiUsage('digikey', {
    endpoint: 'search/keyword',
    parts_returned: parts.length,
    estimated_cost: 0 // DigiKey API is typically free
  });

  return parts;
}

export async function getPartByMpn(mpn: string): Promise<DigiKeyPart | null> {
  const token = await getAccessToken();

  const response = await fetch(`${DIGIKEY_API_URL}/search/keyword`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Keywords: mpn,
      RecordCount: 1,
      RecordStartPosition: 0,
      ExactManufacturerPartNumberMatch: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`DigiKey lookup failed: ${response.status}`);
  }

  const data = await response.json();

  // DigiKey API v4 returns Products array
  const part = data.Products?.[0] || null;

  // Debug: log the raw response structure
  if (part) {
    console.log('[DigiKey] Raw part keys:', Object.keys(part));
    console.log('[DigiKey] MPN field:', part.ManufacturerPartNumber || part.ManufacturerProductNumber || part.PartNumber);
    console.log('[DigiKey] ProductStatus:', part.ProductStatus);
  }

  await trackApiUsage('digikey', {
    endpoint: 'search/keyword',
    parts_returned: part ? 1 : 0,
    estimated_cost: 0
  });

  return part;
}

export function normalizeDigiKeyPart(part: DigiKeyPart & Record<string, unknown>) {
  const specs: Record<string, unknown> = {};

  for (const param of part.Parameters || []) {
    const name = param.ParameterText.toLowerCase().replace(/\s+/g, '_');
    const value = parseSpecValue(param.ValueText);
    specs[name] = value;
  }

  // DigiKey API v4 may use different field names
  const mpn = part.ManufacturerPartNumber
    || (part.ManufacturerProductNumber as string)
    || (part.PartNumber as string)
    || (part.ProductVariations?.[0]?.ManufacturerPartNumber as string);

  const manufacturer = part.Manufacturer?.Name
    || (part.Manufacturer as unknown as string)
    || 'Unknown';

  // Description can be a string or an object with ProductDescription/DetailedDescription
  let description = '';
  if (typeof part.Description === 'string') {
    description = part.Description;
  } else if (part.Description && typeof part.Description === 'object') {
    const desc = part.Description as { ProductDescription?: string; DetailedDescription?: string };
    description = desc.ProductDescription || desc.DetailedDescription || '';
  } else if (part.ProductDescription) {
    description = part.ProductDescription;
  } else if (part.DetailedDescription) {
    description = part.DetailedDescription as string;
  }

  const datasheet = part.PrimaryDatasheet
    || (part.DatasheetUrl as string)
    || (part.PrimaryDatasheetUrl as string);

  return {
    mpn,
    manufacturer,
    description,
    datasheet_url: datasheet,
    lifecycle_status: mapLifecycleStatus(part.ProductStatus || '', part),
    specs
  };
}

function parseSpecValue(value: string): number | string {
  const match = value.match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) {
      return num;
    }
  }
  return value;
}

function mapLifecycleStatus(status: unknown, part?: Record<string, unknown>): string {
  // First check explicit flags if part is provided
  if (part) {
    if (part.EndOfLife === true) return 'Obsolete';
    if (part.Discontinued === true) return 'Obsolete';
  }

  if (!status) return 'Active'; // Default to Active for DigiKey parts in stock

  // Handle status as object (DigiKey v4 returns { Status: "Active", ... })
  let statusStr = '';
  if (typeof status === 'string') {
    statusStr = status;
  } else if (typeof status === 'object' && status !== null) {
    const statusObj = status as Record<string, unknown>;
    statusStr = (statusObj.Status as string) || (statusObj.status as string) || '';
  }

  if (!statusStr) return 'Active';

  const statusLower = statusStr.toLowerCase();

  // Map various status strings
  if (statusLower.includes('active') || statusLower.includes('in stock')) return 'Active';
  if (statusLower.includes('obsolete') || statusLower.includes('end of life')) return 'Obsolete';
  if (statusLower.includes('nrnd') || statusLower.includes('not recommended') ||
      statusLower.includes('last time buy') || statusLower.includes('not for new')) return 'NRND';

  const statusMap: Record<string, string> = {
    'Active': 'Active',
    'Obsolete': 'Obsolete',
    'Not For New Designs': 'NRND',
    'Last Time Buy': 'NRND',
    'Discontinued': 'Obsolete',
  };

  return statusMap[status] || 'Unknown';
}
