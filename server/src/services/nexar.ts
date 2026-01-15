import { GraphQLClient, gql } from 'graphql-request';
import { trackApiUsage } from '../db/queries';
import type { NexarPart } from '../types';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';

// Token management
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Nexar credentials not configured');
  }

  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  // Get new token
  const response = await fetch('https://identity.nexar.com/connect/token', {
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
    throw new Error(`Failed to get Nexar token: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  return accessToken!;
}

const SEARCH_PARTS_QUERY = gql`
  query SearchParts($query: String!, $limit: Int!) {
    supSearch(
      q: $query
      limit: $limit
    ) {
      results {
        part {
          mpn
          manufacturer {
            name
          }
          shortDescription
          specs {
            attribute {
              name
            }
            displayValue
          }
          bestDatasheet {
            url
          }
          category {
            name
          }
        }
      }
    }
  }
`;

const GET_PART_QUERY = gql`
  query GetPart($mpn: String!) {
    supSearchMpn(
      q: $mpn
      limit: 1
    ) {
      results {
        part {
          mpn
          manufacturer {
            name
          }
          shortDescription
          specs {
            attribute {
              name
            }
            displayValue
          }
          bestDatasheet {
            url
          }
          category {
            name
          }
        }
      }
    }
  }
`;

export async function searchParts(query: string, limit = 20): Promise<NexarPart[]> {
  const token = await getAccessToken();
  const client = new GraphQLClient(NEXAR_API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await client.request<{
    supSearch: { results: Array<{ part: NexarPart }> };
  }>(SEARCH_PARTS_QUERY, { query, limit });

  const parts = data.supSearch.results.map(r => r.part);

  // Track API usage
  await trackApiUsage('nexar', {
    endpoint: 'supSearch',
    parts_returned: parts.length,
    estimated_cost: 0.001 * parts.length // Estimated cost per part
  });

  return parts;
}

export async function getPartByMpn(mpn: string): Promise<NexarPart | null> {
  const token = await getAccessToken();
  const client = new GraphQLClient(NEXAR_API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await client.request<{
    supSearchMpn: { results: Array<{ part: NexarPart }> };
  }>(GET_PART_QUERY, { mpn });

  const part = data.supSearchMpn.results[0]?.part || null;

  await trackApiUsage('nexar', {
    endpoint: 'supSearchMpn',
    parts_returned: part ? 1 : 0,
    estimated_cost: 0.001
  });

  return part;
}

export function normalizeNexarPart(part: NexarPart) {
  const specs: Record<string, unknown> = {};

  for (const spec of part.specs || []) {
    const name = spec.attribute.name.toLowerCase().replace(/\s+/g, '_');
    const value = parseSpecValue(spec.displayValue);
    specs[name] = value;
  }

  return {
    mpn: part.mpn,
    manufacturer: part.manufacturer.name,
    description: part.shortDescription,
    datasheet_url: part.bestDatasheet?.url,
    category: part.category?.name,
    specs
  };
}

function parseSpecValue(value: string): number | string {
  // Try to parse as number with unit
  const match = value.match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) {
      return num;
    }
  }
  return value;
}
