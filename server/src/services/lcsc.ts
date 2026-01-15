import { trackApiUsage } from '../db/queries';
import type { LCSCPart } from '../types';

// LCSC doesn't have an official API, so this uses their search endpoint
const LCSC_SEARCH_URL = 'https://wmsc.lcsc.com/ftps/wm/search/global';

export async function searchParts(query: string, limit = 20): Promise<LCSCPart[]> {
  try {
    const response = await fetch(LCSC_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword: query,
        currentPage: 1,
        pageSize: limit,
      }),
    });

    if (!response.ok) {
      throw new Error(`LCSC search failed: ${response.status}`);
    }

    const data = await response.json();
    const products = data.result?.productSearchResultVO?.productList || [];

    const parts: LCSCPart[] = products.map((p: Record<string, unknown>) => ({
      number: p.productCode as string,
      manufacturer: p.brandNameEn as string,
      description: p.productDescEn as string,
      datasheet: p.pdfUrl as string,
      package: p.encapStandard as string,
    }));

    await trackApiUsage('lcsc', {
      endpoint: 'search',
      parts_returned: parts.length,
      estimated_cost: 0
    });

    return parts;
  } catch (error) {
    console.error('LCSC search error:', error);
    return [];
  }
}

export async function getPartByNumber(number: string): Promise<LCSCPart | null> {
  const parts = await searchParts(number, 1);
  return parts.find(p => p.number === number) || null;
}

export function normalizeLCSCPart(part: LCSCPart) {
  return {
    mpn: part.number,
    manufacturer: part.manufacturer,
    description: part.description,
    datasheet_url: part.datasheet,
    package_raw: part.package,
    lifecycle_status: 'Active', // LCSC typically only lists active parts
    specs: {}
  };
}
