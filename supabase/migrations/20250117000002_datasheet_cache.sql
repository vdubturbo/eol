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

ALTER TABLE public.components
ADD COLUMN IF NOT EXISTS mpn_suffix TEXT;

-- Index for cache lookups
CREATE INDEX idx_components_datasheet_cache ON public.components(datasheet_cache_id);

-- Seed multi-pinout extraction prompt
INSERT INTO public.llm_prompts (name, display_name, description, category, system_prompt, user_prompt_template, model, temperature, max_tokens)
VALUES (
  'multi_pinout_extraction',
  'Multi-Package Pinout Extraction',
  'Extracts ALL pinout variants from a datasheet that covers multiple packages. Critical for parts like AZ1117C where different suffixes have different pinouts.',
  'extraction',
  'You are an expert electronics engineer analyzing component datasheets.

CRITICAL INSTRUCTIONS:
1. Many datasheets show MULTIPLE package variants with DIFFERENT pinouts
2. The same base part (e.g., AZ1117C) can have suffixes like H, H2, R, R2, D that indicate different packages AND different pin assignments
3. You MUST extract EACH variant separately - do NOT assume they are the same
4. Pay close attention to the pin numbering on diagrams - Pin 1 is often at the bottom when viewing from top
5. The TAB on packages like SOT-223 counts as an additional pin (often Pin 4)
6. Look for "Option 1", "Option 2" variants within the same package type

Always respond with valid JSON.',

  E'This datasheet covers multiple package variants. Extract the pinout for EACH package variant shown.

Component family: {{mpn_base}}

IMPORTANT: Look for ALL pinout diagrams in the document. Different suffixes (H, H2, R, R2, D, etc.) often have DIFFERENT pin assignments even for the same physical package!

For each package variant found, extract:
1. The exact pin assignments (Pin 1, Pin 2, Pin 3, and Tab if applicable)
2. The suffix that corresponds to this pinout (found in ordering information)
3. Any aliases for the package name

Return a JSON object with ALL package variants:
{
  "packages": {
    "SOT223_H": {
      "pins": [
        {"pin_number": 1, "pin_name": "ADJ/GND", "pin_function": "GROUND"},
        {"pin_number": 2, "pin_name": "OUTPUT", "pin_function": "OUTPUT_VOLTAGE"},
        {"pin_number": 3, "pin_name": "INPUT", "pin_function": "INPUT_VOLTAGE"},
        {"pin_number": 4, "pin_name": "TAB", "pin_function": "OUTPUT_VOLTAGE", "notes": "Connected to OUTPUT"}
      ],
      "aliases": ["SOT223", "SOT-223-3", "SOT-223-4"],
      "suffix_hints": ["H"]
    }
  },
  "specs": {
    "vin_max": 15,
    "iout_max": 0.8
  },
  "notes": "Pin assignments vary between H/H2/R/R2 variants"
}

Valid pin_function values: INPUT_VOLTAGE, OUTPUT_VOLTAGE, GROUND, ADJUST, ENABLE, FEEDBACK, NC, OTHER

CRITICAL: Do not assume all packages have the same pinout! Check each diagram carefully.

Datasheet text:
{{datasheet_text}}',
  'gpt-4o-mini',
  0.1,
  4000
) ON CONFLICT (name) DO NOTHING;
