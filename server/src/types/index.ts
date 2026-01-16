// Re-export shared types
export * from '../../../shared/types';

// Server-specific types
export interface NexarPart {
  mpn: string;
  manufacturer: {
    name: string;
  };
  shortDescription: string;
  specs: Array<{
    attribute: { name: string };
    displayValue: string;
  }>;
  bestDatasheet?: {
    url: string;
  };
  category?: {
    name: string;
  };
}

export interface DigiKeyPart {
  ManufacturerPartNumber?: string;
  ManufacturerProductNumber?: string;
  PartNumber?: string;
  Manufacturer?: {
    Name?: string;
  } | string;
  ProductDescription?: string;
  DetailedDescription?: string;
  Description?: string | { ProductDescription?: string; DetailedDescription?: string };
  Parameters?: Array<{
    ParameterText: string;
    ValueText: string;
  }>;
  PrimaryDatasheet?: string;
  DatasheetUrl?: string;
  PrimaryDatasheetUrl?: string;
  ProductStatus?: string | { Status?: string; status?: string };
  ProductVariations?: Array<{ ManufacturerPartNumber?: string }>;
  EndOfLife?: boolean;
  Discontinued?: boolean;
  [key: string]: unknown; // Allow additional fields
}

export interface MouserPart {
  ManufacturerPartNumber: string;
  Manufacturer: string;
  Description: string;
  DataSheetUrl: string;
  LifecycleStatus: string;
}

export interface LCSCPart {
  number: string;
  manufacturer: string;
  description: string;
  datasheet: string;
  package: string;
}

export interface ExtractedPinout {
  pin_number: number;
  pin_name: string;
  pin_function: string;
  confidence: number;
}

export interface ExtractedSpecs {
  vin_min?: number;
  vin_max?: number;
  vout_min?: number;
  vout_max?: number;
  iout_max?: number;
  switching_freq_min?: number;
  switching_freq_max?: number;
  [key: string]: unknown;
}
