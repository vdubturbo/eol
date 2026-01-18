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

export async function searchParts(query: string, limit = 50): Promise<DigiKeyPart[]> {
  const token = await getAccessToken();

  // DigiKey API v4 max limit is 50
  const actualLimit = Math.min(limit, 50);

  const response = await fetch(`${DIGIKEY_API_URL}/search/keyword`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Keywords: query,
      Limit: actualLimit,
      Offset: 0,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[DigiKey] Search failed: ${response.status}`, errorBody);
    throw new Error(`DigiKey search failed: ${response.status} - ${errorBody}`);
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
      Limit: 1,
      Offset: 0,
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

export function normalizeDigiKeyPart(part: DigiKeyPart) {
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

  let manufacturer = 'Unknown';
  if (typeof part.Manufacturer === 'string') {
    manufacturer = part.Manufacturer;
  } else if (part.Manufacturer && typeof part.Manufacturer === 'object') {
    manufacturer = part.Manufacturer.Name || 'Unknown';
  }

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

  // IMPROVED: Extract package from multiple sources with priority
  let packageRaw = '';
  let packageSource: 'api_params' | 'api_description' | 'manual' = 'api_params';

  // Priority 1: Parse from description (most reliable for specific packages)
  // Example: "IC REG LINEAR 2.5V 1A SOT89-3"
  const descPackage = extractPackageFromDescription(description);
  if (descPackage) {
    packageRaw = descPackage;
    packageSource = 'api_description';
  }

  // Priority 2: Check for Package/Case in Parameters
  if (!packageRaw) {
    const packageParam = (part.Parameters || []).find(
      p => p.ParameterText?.toLowerCase().includes('package') ||
           p.ParameterText?.toLowerCase().includes('case')
    );
    if (packageParam?.ValueText) {
      packageRaw = packageParam.ValueText;
      packageSource = 'api_params';
    }
  }

  // Priority 3: Direct Package field
  if (!packageRaw && part.Package) {
    packageRaw = typeof part.Package === 'string' ? part.Package : (part.Package as { Name?: string })?.Name || '';
    packageSource = 'api_params';
  }

  // Normalize common package names
  const packageNormalized = packageRaw ? normalizePackageName(packageRaw) : '';

  // Extract MPN suffix for pinout matching
  const mpnSuffix = extractMpnSuffix(mpn);

  console.log(`[DigiKey] Package for ${mpn}: raw="${packageRaw}" normalized="${packageNormalized}" source=${packageSource} suffix="${mpnSuffix}"`);

  return {
    mpn,
    manufacturer,
    description,
    datasheet_url: datasheet,
    lifecycle_status: mapLifecycleStatus(part.ProductStatus || '', part),
    package_raw: packageRaw || undefined,
    package_normalized: packageNormalized || undefined,
    package_source: packageSource,
    mpn_suffix: mpnSuffix,
    specs
  };
}

// Extract package from description text
function extractPackageFromDescription(description: string): string | null {
  if (!description) return null;

  // Common package patterns in descriptions (order by specificity)
  const patterns = [
    /\b(SOT-?89-?\d?)\b/i,
    /\b(SOT-?223-?\d?)\b/i,
    /\b(TO-?252-?\d?)\b/i,
    /\b(TO-?263-?\d?)\b/i,
    /\b(TO-?220[A-Z]*-?\d?)\b/i,
    /\b(TO-?92[A-Z]*-?\d?)\b/i,
    /\b(SOIC-?\d+)\b/i,
    /\b(SOP-?\d+)\b/i,
    /\b(MSOP-?\d+)\b/i,
    /\b(TSSOP-?\d+)\b/i,
    /\b(SSOP-?\d+)\b/i,
    /\b(QFN-?\d+)\b/i,
    /\b(DFN-?\d+)\b/i,
    /\b(VQFN-?\d+)\b/i,
    /\b(WSON-?\d+)\b/i,
    /\b(D-?PAK)\b/i,
    /\b(D2-?PAK)\b/i,
    /\b(DPAK)\b/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Extract MPN suffix for package variant matching
function extractMpnSuffix(mpn: string): string | null {
  if (!mpn) return null;

  // Pattern for common voltage regulator MPNs:
  // AZ1117CH-3.3TRG1 -> "H"
  // AZ1117CR-3.3TRG1 -> "R"
  // AZ1117CR2-3.3TRG1 -> "R2"
  // LM1117DT-3.3 -> "DT"

  // Try: XXXX1117[letters]SUFFIX-voltage
  const match1 = mpn.match(/\d{4}[A-Z]*([A-Z]\d?)-[\d.]/i);
  if (match1) return match1[1].toUpperCase();

  // Try: XX1117SUFFIX-voltage (shorter prefix)
  const match2 = mpn.match(/\d{2,4}([A-Z]{1,2}\d?)-[\d.]/i);
  if (match2) return match2[1].toUpperCase();

  // Generic pattern: letters followed by suffix before dash+number
  const match3 = mpn.match(/[A-Z]+\d+([A-Z]{1,3})-/i);
  if (match3) return match3[1].toUpperCase();

  return null;
}

// Normalize package names to standard formats
function normalizePackageName(raw: string): string {
  const upper = raw.toUpperCase().trim();
  
  // Common package mappings
  const mappings: Record<string, string> = {
    'SOT-223': 'SOT-223',
    'SOT-223-4': 'SOT-223',
    'SOT223': 'SOT-223',
    'TO-252': 'TO-252',
    'TO252': 'TO-252',
    'DPAK': 'TO-252',
    'D-PAK': 'TO-252',
    'TO-263': 'TO-263',
    'TO263': 'TO-263',
    'D2PAK': 'TO-263',
    'D2-PAK': 'TO-263',
    'SOIC-8': 'SOIC-8',
    'SOIC8': 'SOIC-8',
    'SO-8': 'SOIC-8',
    'SO8': 'SOIC-8',
    'SOP-8': 'SOIC-8',
    'MSOP-8': 'MSOP-8',
    'MSOP8': 'MSOP-8',
    'TSSOP-8': 'TSSOP-8',
    'QFN-16': 'QFN-16',
    'QFN16': 'QFN-16',
    'DFN-8': 'DFN-8',
    'DFN8': 'DFN-8',
  };
  
  // Check direct mapping
  for (const [pattern, normalized] of Object.entries(mappings)) {
    if (upper.includes(pattern)) {
      return normalized;
    }
  }
  
  // Try to extract standard format (e.g., "8-SOIC" -> "SOIC-8")
  const match = upper.match(/(\d+)[\s-]*(SOIC|MSOP|TSSOP|QFN|DFN|SOP|SOT|TO)/);
  if (match) {
    return `${match[2]}-${match[1]}`;
  }
  
  // Try reverse format (e.g., "SOIC-8")
  const match2 = upper.match(/(SOIC|MSOP|TSSOP|QFN|DFN|SOP|SOT|TO)[\s-]*(\d+)/);
  if (match2) {
    return `${match2[1]}-${match2[2]}`;
  }
  
  // Return cleaned up version if no mapping found
  return raw.trim();
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

  return statusMap[statusStr] || 'Unknown';
}
