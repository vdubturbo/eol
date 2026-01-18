// Auth Types
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// Core Types
export interface Manufacturer {
  id: string;
  name: string;
  aliases: string[];
  created_at: string;
  updated_at: string;
}

export interface Component {
  id: string;
  mpn: string;
  manufacturer_id: string | null;
  description: string | null;

  // Package info
  package_raw: string | null;
  package_normalized: string | null;
  mounting_style: 'SMD' | 'THT' | null;
  pin_count: number | null;

  // Electrical specs
  specs: ComponentSpecs;

  // Status
  lifecycle_status: LifecycleStatus;
  datasheet_url: string | null;

  // Data quality
  data_sources: DataSource[];
  confidence_score: number;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Relations (when joined)
  manufacturer?: Manufacturer;
  pinouts?: Pinout[];
  dimensions?: PackageDimensions;
}

export interface ComponentSpecs {
  vin_min?: number;
  vin_max?: number;
  vout_min?: number;
  vout_max?: number;
  vout_type?: 'Fixed' | 'Adjustable';
  iout_max?: number;
  switching_freq_min?: number;
  switching_freq_max?: number;
  efficiency?: number;
  operating_temp_min?: number;
  operating_temp_max?: number;
  [key: string]: unknown;
}

export type LifecycleStatus = 'Active' | 'NRND' | 'Obsolete' | 'Unknown';

export interface Pinout {
  id: string;
  component_id: string;
  pin_number: number;
  pin_name: string | null;
  pin_function: PinFunction;
  pin_description: string | null;
  source: DataSource | null;
  confidence: number;
  created_at: string;
}

export type PinFunction =
  | 'INPUT_VOLTAGE'
  | 'OUTPUT_VOLTAGE'
  | 'GROUND'
  | 'ENABLE'
  | 'FEEDBACK'
  | 'BOOTSTRAP'
  | 'SWITCH_NODE'
  | 'COMPENSATION'
  | 'SOFT_START'
  | 'POWER_GOOD'
  | 'FREQUENCY'
  | 'SYNC'
  | 'NC'
  | 'OTHER';

export interface PackageDimensions {
  id: string;
  component_id: string;
  body_length: number | null;
  body_width: number | null;
  body_height: number | null;
  lead_pitch: number | null;
  lead_span: number | null;
  has_thermal_pad: boolean;
  thermal_pad_length: number | null;
  thermal_pad_width: number | null;
  source: DataSource | null;
  created_at: string;
}

export type DataSource = 'nexar' | 'digikey' | 'mouser' | 'lcsc' | 'pdf' | 'manual';

// Search Types
export interface SearchFilters {
  query?: string;
  package?: string;
  mounting_style?: 'SMD' | 'THT';
  pin_count?: number;
  lifecycle_status?: LifecycleStatus[];
  vin_min?: number;
  vin_max?: number;
  iout_min?: number;
  manufacturer_id?: string;
}

export interface SearchResult {
  components: ComponentWithManufacturer[];
  total: number;
  page: number;
  page_size: number;
}

export type ComponentWithManufacturer = Component & {
  manufacturer: Manufacturer | null;
};

export type ComponentWithDetails = Component & {
  manufacturer: Manufacturer | null;
  pinouts: Pinout[];
  dimensions: PackageDimensions | null;
};

export interface ReplacementResult {
  component: ComponentWithManufacturer;
  match_score: number;
  pinout_match: {
    matched: number;
    total: number;
    differences: PinoutDifference[];
  };
  specs_match: {
    compatible: string[];
    incompatible: string[];
    warnings: string[];
  };
}

export interface PinoutDifference {
  pin_number: number;
  original_function: PinFunction;
  replacement_function: PinFunction;
  severity: 'compatible' | 'warning' | 'incompatible';
}

// Job Types
export interface IngestionJob {
  id: string;
  job_type: 'api_fetch' | 'pdf_extract' | 'enrich' | 'full_import';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  params: {
    source?: DataSource;
    category?: string;
    part_numbers?: string[];
    [key: string]: unknown;
  };
  total_items: number;
  processed_items: number;
  failed_items: number;
  result: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiUsage {
  id: string;
  api_name: string;
  endpoint: string | null;
  request_count: number;
  parts_returned: number;
  tokens_used: number;
  estimated_cost: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Stats
export interface DashboardStats {
  total_components: number;
  components_with_pinouts: number;
  extraction_success_rate: number;
  pending_jobs: number;
  mtd_api_cost: number;
}

// Compare
export interface CompareState {
  reference_id: string | null;
  compare_ids: string[];
}

// Filter Options
export interface FilterOptions {
  packages: string[];
  manufacturers: { id: string; name: string }[];
}

// LLM Prompt Types
export interface LLMPrompt {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface LLMPromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  created_at: string;
  created_by: string | null;
  change_notes: string | null;
}

export interface LLMPromptLog {
  id: string;
  prompt_id: string | null;
  prompt_name: string;
  input_variables: Record<string, unknown>;
  rendered_user_prompt: string;
  response_raw: string;
  response_parsed: unknown;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  estimated_cost: number;
  component_mpn: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface LLMPromptWithVersions extends LLMPrompt {
  versions: LLMPromptVersion[];
}

export interface LLMPromptStats {
  prompt_name: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  success_rate: number;
  total_tokens: number;
  total_cost: number;
  avg_latency_ms: number;
}
