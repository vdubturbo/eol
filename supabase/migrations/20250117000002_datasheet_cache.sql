-- Datasheet Cache for Smart Pinout Extraction

-- Cache extracted data from datasheets
CREATE TABLE public.datasheet_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  datasheet_url TEXT NOT NULL UNIQUE,
  datasheet_hash TEXT,

  -- Extracted content
  raw_text TEXT,
  text_length INTEGER,
  page_count INTEGER,

  -- Multi-package pinouts (the key improvement!)
  pinouts_by_package JSONB NOT NULL DEFAULT '{}',

  -- Extracted specs (shared across variants)
  specs JSONB DEFAULT '{}',

  -- Metadata
  extraction_model TEXT,
  extraction_prompt_version INTEGER,
  extraction_tokens INTEGER,
  extraction_cost NUMERIC(10,6),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes
CREATE INDEX idx_datasheet_cache_url ON public.datasheet_cache(datasheet_url);
CREATE INDEX idx_datasheet_cache_status ON public.datasheet_cache(status);
CREATE INDEX idx_datasheet_cache_expires ON public.datasheet_cache(expires_at);

-- Trigger for updated_at
CREATE TRIGGER datasheet_cache_updated_at
  BEFORE UPDATE ON public.datasheet_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add package/pinout source tracking to components
ALTER TABLE public.components
ADD COLUMN IF NOT EXISTS package_source TEXT CHECK (package_source IN ('api_params', 'api_description', 'datasheet', 'manual'));

ALTER TABLE public.components
ADD COLUMN IF NOT EXISTS pinout_source TEXT CHECK (pinout_source IN ('datasheet_cache', 'direct_extraction', 'manual'));

ALTER TABLE public.components
ADD COLUMN IF NOT EXISTS datasheet_cache_id UUID REFERENCES public.datasheet_cache(id);

-- Index for cache lookups
CREATE INDEX idx_components_datasheet_cache ON public.components(datasheet_cache_id);
