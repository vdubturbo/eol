-- Pin function enum type
CREATE TYPE pin_function AS ENUM (
    'INPUT_VOLTAGE',
    'OUTPUT_VOLTAGE',
    'GROUND',
    'ENABLE',
    'FEEDBACK',
    'BOOTSTRAP',
    'SWITCH_NODE',
    'COMPENSATION',
    'SOFT_START',
    'POWER_GOOD',
    'FREQUENCY',
    'SYNC',
    'NC',
    'OTHER'
);

-- Pinouts table
CREATE TABLE pinouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    pin_number INTEGER NOT NULL,
    pin_name TEXT,
    pin_function pin_function DEFAULT 'OTHER',
    pin_description TEXT,
    source TEXT,
    confidence REAL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(component_id, pin_number)
);

-- Index for pinout queries
CREATE INDEX idx_pinouts_component ON pinouts(component_id);
CREATE INDEX idx_pinouts_function ON pinouts(pin_function);

-- Function to search by pinout pattern
CREATE OR REPLACE FUNCTION search_by_pinout(
    target_package TEXT,
    pin_requirements JSONB
)
RETURNS TABLE (
    component_id UUID,
    mpn TEXT,
    manufacturer_name TEXT,
    match_count INTEGER,
    total_required INTEGER,
    match_score REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH requirements AS (
        SELECT
            (elem->>'pin')::INTEGER as pin_num,
            (elem->>'function')::pin_function as func
        FROM jsonb_array_elements(pin_requirements) as elem
    ),
    matches AS (
        SELECT
            c.id,
            c.mpn,
            m.name as manufacturer_name,
            COUNT(CASE WHEN p.pin_function = r.func THEN 1 END)::INTEGER as matched,
            (SELECT COUNT(*) FROM requirements)::INTEGER as required
        FROM components c
        LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
        LEFT JOIN pinouts p ON c.id = p.component_id
        LEFT JOIN requirements r ON p.pin_number = r.pin_num
        WHERE c.package_normalized = target_package
        GROUP BY c.id, c.mpn, m.name
    )
    SELECT
        matches.id,
        matches.mpn,
        matches.manufacturer_name,
        matches.matched,
        matches.required,
        CASE WHEN matches.required > 0
             THEN matches.matched::REAL / matches.required::REAL
             ELSE 0
        END as match_score
    FROM matches
    WHERE matches.matched > 0
    ORDER BY match_score DESC;
END;
$$ LANGUAGE plpgsql;
