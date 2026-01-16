import { supabase } from '../lib/supabase';
import type {
  SearchFilters,
  SearchResult,
  ComponentWithDetails,
  ReplacementResult,
  IngestionJob,
  DashboardStats,
  ApiUsage,
  FilterOptions,
} from '@shared/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Helper for API calls to Express backend
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Search - uses Express API
export async function searchComponents(
  filters: SearchFilters,
  page = 1,
  pageSize = 25
): Promise<SearchResult> {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.package) params.set('package', filters.package);
  if (filters.mounting_style) params.set('mounting_style', filters.mounting_style);
  if (filters.pin_count) params.set('pin_count', String(filters.pin_count));
  if (filters.lifecycle_status?.length) {
    params.set('lifecycle_status', filters.lifecycle_status.join(','));
  }
  if (filters.manufacturer_id) params.set('manufacturer_id', filters.manufacturer_id);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  return fetchAPI<SearchResult>(`/components?${params.toString()}`);
}

// Get single component with all details
export async function getComponent(id: string): Promise<ComponentWithDetails> {
  return fetchAPI<ComponentWithDetails>(`/components/${id}`);
}

// Find drop-in replacements - uses backend for complex logic
export async function findReplacements(mpn: string): Promise<ReplacementResult[]> {
  return fetchAPI<ReplacementResult[]>(
    `/search/replacements/${encodeURIComponent(mpn)}`
  );
}

// Compare components
export async function compareComponents(ids: string[]): Promise<ComponentWithDetails[]> {
  const { data, error } = await supabase
    .from('components')
    .select(
      `
      *,
      manufacturer:manufacturers(*),
      pinouts(*),
      dimensions:package_dimensions(*)
    `
    )
    .in('id', ids);

  if (error) throw error;
  return (data as ComponentWithDetails[]) || [];
}

// Get available filter options
export async function getFilterOptions(): Promise<FilterOptions> {
  const [packagesResult, manufacturersResult] = await Promise.all([
    supabase
      .from('components')
      .select('package_normalized')
      .not('package_normalized', 'is', null)
      .order('package_normalized'),
    supabase.from('manufacturers').select('id, name').order('name'),
  ]);

  const uniquePackages = [
    ...new Set(packagesResult.data?.map((p) => p.package_normalized)),
  ];

  return {
    packages: uniquePackages.filter(Boolean) as string[],
    manufacturers: manufacturersResult.data || [],
  };
}

// Admin APIs
export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchAPI<DashboardStats>('/admin/stats');
}

export async function getJobs(status?: string): Promise<IngestionJob[]> {
  let query = supabase
    .from('ingestion_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as IngestionJob[]) || [];
}

export async function createJob(params: {
  job_type: IngestionJob['job_type'];
  source?: string;
  category?: string;
  part_numbers?: string[];
}): Promise<IngestionJob> {
  return fetchAPI<IngestionJob>('/admin/jobs', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function retryJob(id: string): Promise<IngestionJob> {
  return fetchAPI<IngestionJob>(`/admin/jobs/${id}/retry`, {
    method: 'POST',
  });
}

export async function cancelJob(id: string): Promise<IngestionJob> {
  return fetchAPI<IngestionJob>(`/admin/jobs/${id}/cancel`, {
    method: 'POST',
  });
}

export async function getApiUsage(days = 30): Promise<ApiUsage[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('api_usage')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as ApiUsage[]) || [];
}

export async function getApiUsageSummary(
  days = 30
): Promise<
  Array<{
    api_name: string;
    total_requests: number;
    total_parts: number;
    total_cost: number;
  }>
> {
  return fetchAPI(`/admin/api-usage/summary?days=${days}`);
}
