import { supabaseAdmin } from './supabase';
import type { Component, Manufacturer, Pinout, PackageDimensions, IngestionJob } from '../types';

// Component queries
export async function getComponentById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('components')
    .select(`
      *,
      manufacturer:manufacturers(*),
      pinouts(*),
      dimensions:package_dimensions(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getComponentByMpn(mpn: string) {
  const { data, error } = await supabaseAdmin
    .from('components')
    .select(`
      *,
      manufacturer:manufacturers(*),
      pinouts(*)
    `)
    .eq('mpn', mpn)
    .single();

  if (error) throw error;
  return data;
}

export async function searchComponents(
  filters: {
    query?: string;
    package?: string;
    mounting_style?: string;
    pin_count?: number;
    lifecycle_status?: string[];
    manufacturer_id?: string;
  },
  page = 1,
  pageSize = 25
) {
  let query = supabaseAdmin
    .from('components')
    .select(`
      *,
      manufacturer:manufacturers(*)
    `, { count: 'exact' });

  if (filters.query) {
    query = query.or(`mpn.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
  }
  if (filters.package) {
    query = query.eq('package_normalized', filters.package);
  }
  if (filters.mounting_style) {
    query = query.eq('mounting_style', filters.mounting_style);
  }
  if (filters.pin_count) {
    query = query.eq('pin_count', filters.pin_count);
  }
  if (filters.lifecycle_status?.length) {
    query = query.in('lifecycle_status', filters.lifecycle_status);
  }
  if (filters.manufacturer_id) {
    query = query.eq('manufacturer_id', filters.manufacturer_id);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('mpn');

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    components: data || [],
    total: count || 0,
    page,
    page_size: pageSize
  };
}

export async function findSamePackageComponents(packageNormalized: string, excludeId: string) {
  const { data, error } = await supabaseAdmin
    .from('components')
    .select(`
      *,
      manufacturer:manufacturers(*),
      pinouts(*)
    `)
    .eq('package_normalized', packageNormalized)
    .neq('id', excludeId)
    .limit(50);

  if (error) throw error;
  return data || [];
}

// Manufacturer queries
export async function getOrCreateManufacturer(name: string): Promise<Manufacturer> {
  // Try to find existing
  const { data: existing } = await supabaseAdmin
    .from('manufacturers')
    .select('*')
    .eq('name', name)
    .single();

  if (existing) return existing;

  // Create new
  const { data: created, error } = await supabaseAdmin
    .from('manufacturers')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// Component upsert
export async function upsertComponent(component: Partial<Component>, manufacturerName?: string) {
  let manufacturerId = component.manufacturer_id;

  if (manufacturerName && !manufacturerId) {
    const manufacturer = await getOrCreateManufacturer(manufacturerName);
    manufacturerId = manufacturer.id;
  }

  const { data, error } = await supabaseAdmin
    .from('components')
    .upsert({
      ...component,
      manufacturer_id: manufacturerId
    }, {
      onConflict: 'mpn,manufacturer_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Pinout queries
export async function upsertPinouts(componentId: string, pinouts: Partial<Pinout>[]) {
  const pinoutData = pinouts.map(p => ({
    ...p,
    component_id: componentId
  }));

  const { data, error } = await supabaseAdmin
    .from('pinouts')
    .upsert(pinoutData, {
      onConflict: 'component_id,pin_number'
    })
    .select();

  if (error) throw error;
  return data;
}

// Job queries
export async function createJob(jobData: Partial<IngestionJob>): Promise<IngestionJob> {
  const { data, error } = await supabaseAdmin
    .from('ingestion_jobs')
    .insert(jobData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJob(id: string, updates: Partial<IngestionJob>) {
  const { data, error } = await supabaseAdmin
    .from('ingestion_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getJobById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('ingestion_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Stats queries
export async function getDashboardStats() {
  const [
    { count: totalComponents },
    { count: withPinouts },
    { count: pendingJobs },
    apiUsage
  ] = await Promise.all([
    supabaseAdmin.from('components').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('pinouts')
      .select('component_id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('ingestion_jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']),
    supabaseAdmin
      .from('api_usage')
      .select('estimated_cost')
      .gte('created_at', new Date(new Date().setDate(1)).toISOString())
  ]);

  const mtdCost = apiUsage.data?.reduce((sum, r) => sum + (r.estimated_cost || 0), 0) || 0;
  const successRate = totalComponents && withPinouts
    ? ((withPinouts || 0) / (totalComponents || 1)) * 100
    : 0;

  return {
    total_components: totalComponents || 0,
    components_with_pinouts: withPinouts || 0,
    extraction_success_rate: Math.round(successRate * 10) / 10,
    pending_jobs: pendingJobs || 0,
    mtd_api_cost: Math.round(mtdCost * 100) / 100
  };
}

// API usage tracking
export async function trackApiUsage(apiName: string, data: {
  endpoint?: string;
  parts_returned?: number;
  tokens_used?: number;
  estimated_cost?: number;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin
    .from('api_usage')
    .insert({
      api_name: apiName,
      ...data
    });

  if (error) console.error('Failed to track API usage:', error);
}
