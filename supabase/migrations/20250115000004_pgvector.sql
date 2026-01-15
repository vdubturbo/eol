-- Enable vector extension (may need to enable in Supabase dashboard first)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to components
ALTER TABLE components
ADD COLUMN embedding vector(1536);

-- Create vector similarity index
CREATE INDEX idx_components_embedding ON components
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function for semantic search
CREATE OR REPLACE FUNCTION search_components_semantic(
    query_embedding vector(1536),
    match_threshold REAL DEFAULT 0.7,
    match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    mpn TEXT,
    description TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.mpn,
        c.description,
        1 - (c.embedding <=> query_embedding) as similarity
    FROM components c
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
