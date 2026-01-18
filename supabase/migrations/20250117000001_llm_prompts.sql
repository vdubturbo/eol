-- LLM Prompt Management System

-- Store LLM prompts with versioning
CREATE TABLE public.llm_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'extraction',

  -- Prompt content
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,

  -- Configuration
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) DEFAULT 0.1,
  max_tokens INTEGER DEFAULT 4000,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Store prompt versions for history/rollback
CREATE TABLE public.llm_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES public.llm_prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature NUMERIC(3,2),
  max_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_notes TEXT,

  UNIQUE(prompt_id, version)
);

-- Store prompt execution logs for debugging/optimization
CREATE TABLE public.llm_prompt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES public.llm_prompts(id),
  prompt_name TEXT NOT NULL,

  -- Request
  input_variables JSONB,
  rendered_user_prompt TEXT,

  -- Response
  response_raw TEXT,
  response_parsed JSONB,

  -- Metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,
  estimated_cost NUMERIC(10,6),

  -- Context
  component_mpn TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_llm_prompts_name ON public.llm_prompts(name);
CREATE INDEX idx_llm_prompts_category ON public.llm_prompts(category);
CREATE INDEX idx_prompt_logs_prompt_id ON public.llm_prompt_logs(prompt_id);
CREATE INDEX idx_prompt_logs_created_at ON public.llm_prompt_logs(created_at DESC);
CREATE INDEX idx_prompt_logs_component ON public.llm_prompt_logs(component_mpn);
CREATE INDEX idx_prompt_versions_prompt_id ON public.llm_prompt_versions(prompt_id);

-- RLS
ALTER TABLE public.llm_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_prompt_logs ENABLE ROW LEVEL SECURITY;

-- Prompts: Admin read/write
CREATE POLICY "Admins can manage prompts"
  ON public.llm_prompts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Versions: Admin read/write
CREATE POLICY "Admins can manage prompt versions"
  ON public.llm_prompt_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Logs: Admin read only
CREATE POLICY "Admins can view prompt logs"
  ON public.llm_prompt_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow service role to insert logs (for backend)
CREATE POLICY "Service can insert logs"
  ON public.llm_prompt_logs FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER llm_prompts_updated_at
  BEFORE UPDATE ON public.llm_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed default prompts
INSERT INTO public.llm_prompts (name, display_name, description, category, system_prompt, user_prompt_template, model, temperature, max_tokens)
VALUES
(
  'pinout_extraction',
  'Pinout Extraction',
  'Extracts pin assignments from component datasheets. Returns structured pinout data.',
  'extraction',
  'You are an expert electronics engineer analyzing component datasheets. Extract pinout information accurately. Always respond with valid JSON.',
  E'Extract the pinout information from this datasheet text for a {{package_type}} package.

The component is: {{mpn}}

Return a JSON object with this exact structure:
{
  "pins": [
    {
      "pin_number": 1,
      "pin_name": "VIN",
      "pin_function": "INPUT_VOLTAGE",
      "confidence": 0.95
    }
  ],
  "package_detected": "SOT-223",
  "notes": "Any relevant notes about the pinout"
}

Valid pin_function values are:
- INPUT_VOLTAGE, OUTPUT_VOLTAGE, GROUND, ENABLE, FEEDBACK
- BOOTSTRAP, SWITCH_NODE, COMPENSATION, SOFT_START
- POWER_GOOD, FREQUENCY, SYNC, NC, OTHER

Datasheet text:
{{datasheet_text}}',
  'gpt-4o-mini',
  0.1,
  2000
),
(
  'specs_extraction',
  'Specifications Extraction',
  'Extracts electrical specifications from component datasheets.',
  'extraction',
  'You are an expert electronics engineer analyzing component datasheets. Extract electrical specifications accurately. Always respond with valid JSON.',
  E'Extract the key electrical specifications from this datasheet text.

The component is: {{mpn}}

Return a JSON object with available specs:
{
  "vin_min": 4.5,
  "vin_max": 28,
  "vout_min": 0.8,
  "vout_max": 25,
  "iout_max": 3,
  "switching_freq_min": 100000,
  "switching_freq_max": 2000000,
  "efficiency": 95,
  "operating_temp_min": -40,
  "operating_temp_max": 125
}

Only include specs that are clearly stated. Use null for unknown values.
All voltages in Volts, currents in Amps, frequencies in Hz, temperatures in Celsius.

Datasheet text:
{{datasheet_text}}',
  'gpt-4o-mini',
  0.1,
  1500
),
(
  'multi_pinout_extraction',
  'Multi-Package Pinout Extraction',
  'Extracts ALL pinout variants from a datasheet that covers multiple packages.',
  'extraction',
  'You are an expert electronics engineer analyzing component datasheets. This datasheet covers MULTIPLE package variants with DIFFERENT pinouts. Extract ALL of them.',
  E'This datasheet covers multiple package variants. Extract the pinout for EACH package variant shown.

Component family: {{mpn_base}}

Return a JSON object with ALL package variants:
{
  "packages": {
    "SOT-223": {
      "pins": [
        {"pin_number": 1, "pin_name": "INPUT", "pin_function": "INPUT_VOLTAGE"},
        {"pin_number": 2, "pin_name": "OUTPUT", "pin_function": "OUTPUT_VOLTAGE"},
        {"pin_number": 3, "pin_name": "ADJ/GND", "pin_function": "GROUND"}
      ],
      "aliases": ["SOT223", "SOT-223-4"],
      "suffix_hint": "H"
    },
    "SOT-89": {
      "pins": [
        {"pin_number": 1, "pin_name": "ADJ/GND", "pin_function": "GROUND"},
        {"pin_number": 2, "pin_name": "OUTPUT", "pin_function": "OUTPUT_VOLTAGE"},
        {"pin_number": 3, "pin_name": "INPUT", "pin_function": "INPUT_VOLTAGE"}
      ],
      "aliases": ["SOT89", "SOT89-3"],
      "suffix_hint": "R"
    }
  },
  "notes": "Pin 1 is different between SOT-223 and SOT-89 variants"
}

IMPORTANT: Different packages often have DIFFERENT pin assignments even for the same part family!
Look for pinout diagrams, pin assignment tables, or package-specific sections.

Datasheet text:
{{datasheet_text}}',
  'gpt-4o-mini',
  0.1,
  4000
);
