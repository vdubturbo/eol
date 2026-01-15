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
  const part = data.Products?.[0] || null;

  await trackApiUsage('digikey', {
    endpoint: 'search/keyword',
    parts_returned: part ? 1 : 0,
    estimated_cost: 0
  });

  return part;
}

export function normalizeDigiKeyPart(part: DigiKeyPart) {
  const specs: Record<string, unknown> = {};

  for (const param of part.Parameters || []) {
    const name = param.ParameterText.toLowerCase().replace(/\s+/g, '_');
    const value = parseSpecValue(param.ValueText);
    specs[name] = value;
  }

  return {
    mpn: part.ManufacturerPartNumber,
    manufacturer: part.Manufacturer.Name,
    description: part.ProductDescription,
    datasheet_url: part.PrimaryDatasheet,
    lifecycle_status: mapLifecycleStatus(part.ProductStatus),
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

function mapLifecycleStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'Active',
    'Obsolete': 'Obsolete',
    'Not For New Designs': 'NRND',
    'Last Time Buy': 'NRND',
  };
  return statusMap[status] || 'Unknown';
}
