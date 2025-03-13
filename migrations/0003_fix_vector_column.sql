-- Fix vector column type for pgvector compatibility
CREATE EXTENSION IF NOT EXISTS vector;

-- First, check if any records exist in the memories table
DO $$
DECLARE
  record_count INTEGER;
BEGIN
  -- Get count of records in memories table
  SELECT COUNT(*) INTO record_count FROM memories;
  
  -- If there are records, use a temporary table to preserve data
  IF record_count > 0 THEN
    -- Create a backup table
    CREATE TEMP TABLE memories_backup AS SELECT * FROM memories;
    
    -- Drop the original table
    DROP TABLE memories;
    
    -- Recreate the table with the correct column types
    CREATE TABLE memories (
      id SERIAL PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      embedding VECTOR NOT NULL,
      type TEXT NOT NULL,
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      timestamp TIMESTAMP DEFAULT now() NOT NULL,
      metadata JSONB
    );
    
    -- After this, the application needs to handle reinserting the data with proper vector casting
  ELSE
    -- If no records, simply modify the column type
    ALTER TABLE memories ALTER COLUMN embedding TYPE VECTOR USING embedding::vector;
  END IF;
END $$;

-- Create the vector similarity search index
CREATE INDEX IF NOT EXISTS embedding_vector_idx ON memories USING ivfflat (embedding vector_l2_ops);