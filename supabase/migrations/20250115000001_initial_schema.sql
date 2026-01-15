-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Manufacturers table
CREATE TABLE manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    aliases TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Components table
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mpn TEXT NOT NULL,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    description TEXT,

    -- Package info
    package_raw TEXT,
    package_normalized TEXT,
    mounting_style TEXT CHECK (mounting_style IN ('SMD', 'THT')),
    pin_count INTEGER,

    -- Electrical specs (flexible JSON)
    specs JSONB DEFAULT '{}',

    -- Status
    lifecycle_status TEXT DEFAULT 'Unknown' CHECK (lifecycle_status IN ('Active', 'NRND', 'Obsolete', 'Unknown')),
    datasheet_url TEXT,

    -- Data quality
    data_sources TEXT[] DEFAULT '{}',
    confidence_score REAL DEFAULT 0.0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint on MPN + Manufacturer
    UNIQUE(mpn, manufacturer_id)
);

-- Package dimensions table
CREATE TABLE package_dimensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,

    -- Dimensions in mm
    body_length REAL,
    body_width REAL,
    body_height REAL,
    lead_pitch REAL,
    lead_span REAL,

    -- Thermal pad
    has_thermal_pad BOOLEAN DEFAULT FALSE,
    thermal_pad_length REAL,
    thermal_pad_width REAL,

    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(component_id)
);

-- Indexes for search performance
CREATE INDEX idx_components_mpn ON components(mpn);
CREATE INDEX idx_components_package ON components(package_normalized);
CREATE INDEX idx_components_mounting ON components(mounting_style);
CREATE INDEX idx_components_pin_count ON components(pin_count);
CREATE INDEX idx_components_lifecycle ON components(lifecycle_status);
CREATE INDEX idx_components_specs ON components USING gin(specs);
CREATE INDEX idx_components_description ON components USING gin(to_tsvector('english', coalesce(description, '')));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER manufacturers_updated_at
    BEFORE UPDATE ON manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
