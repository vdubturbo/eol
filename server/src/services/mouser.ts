import { trackApiUsage } from '../db/queries';
import type { MouserPart } from '../types';

const MOUSER_API_URL = 'https://api.mouser.com/api/v1';

export async function searchParts(query: string, limit = 20): Promise<MouserPart[]> {
  const apiKey = process.env.MOUSER_API_KEY;

  if (!apiKey) {
    throw new Error('Mouser API key not configured');
  }

  const response = await fetch(`${MOUSER_API_URL}/search/keyword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      SearchByKeywordRequest: {
        keyword: query,
        records: limit,
        startingRecord: 0,
        searchOptions: '',
        searchWithYourSignUpLanguage: '',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Mouser search failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.SearchResults?.Parts || [];

  await trackApiUsage('mouser', {
    endpoint: 'search/keyword',
    parts_returned: parts.length,
    estimated_cost: 0 // Mouser API is typically free
  });

  return parts;
}

export async function getPartByMpn(mpn: string): Promise<MouserPart | null> {
  const apiKey = process.env.MOUSER_API_KEY;

  if (!apiKey) {
    throw new Error('Mouser API key not configured');
  }

  const response = await fetch(`${MOUSER_API_URL}/search/partnumber`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      SearchByPartRequest: {
        mouserPartNumber: mpn,
        partSearchOptions: '',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Mouser lookup failed: ${response.status}`);
  }

  const data = await response.json();
  const part = data.SearchResults?.Parts?.[0] || null;

  await trackApiUsage('mouser', {
    endpoint: 'search/partnumber',
    parts_returned: part ? 1 : 0,
    estimated_cost: 0
  });

  return part;
}

export function normalizeMouserPart(part: MouserPart) {
  return {
    mpn: part.ManufacturerPartNumber,
    manufacturer: part.Manufacturer,
    description: part.Description,
    datasheet_url: part.DataSheetUrl,
    lifecycle_status: mapLifecycleStatus(part.LifecycleStatus),
    specs: {}
  };
}

function mapLifecycleStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'New Product': 'Active',
    'Factory Special Order': 'Active',
    'Not Recommended for New Designs': 'NRND',
    'End of Life': 'Obsolete',
    'Obsolete': 'Obsolete',
  };
  return statusMap[status] || 'Unknown';
}
