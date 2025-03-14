-- Add vector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing indexes to prevent conflicts
DROP INDEX IF EXISTS embedding_idx;
DROP INDEX IF EXISTS embedding_vector_idx;

-- Backup existing data and recreate memories table with proper vector type
DO $$
BEGIN
  -- Create temporary table to hold data (if any exists)
  CREATE TEMP TABLE temp_memories AS 
  SELECT 
    id, 
    content, 
    embedding::text, -- Convert embedding to text for safe storage 
    type, 
    message_id, 
    timestamp, 
    metadata
  FROM memories;
  
  -- Drop the original table completely
  DROP TABLE IF EXISTS memories;
  
  -- Recreate memories table with vector datatype
  CREATE TABLE memories (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL, -- Set explicit dimensions for OpenAI embeddings
    type TEXT NOT NULL,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB
  );
  
  -- Create a HNSW index for faster cosine distance searches and future Pinecone compatibility
  -- HNSW (Hierarchical Navigable Small World) indexes support hash-based lookups
  CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops);
  
  -- Add a hash index on id for efficient lookups (helpful for future syncing with Pinecone)
  CREATE INDEX memories_id_hash_idx ON memories USING hash (id);
  
  -- Restore data from temporary table
  -- Note: We need to handle case where embedding was NULL in the original table
  INSERT INTO memories (id, content, embedding, type, message_id, timestamp, metadata)
  SELECT 
    id, 
    content, 
    CASE 
      WHEN embedding IS NULL THEN '[0,0,0]'::vector(1536) -- Default placeholder vector if embedding was NULL
      ELSE embedding::vector(1536) -- Cast text representation back to vector
    END,
    type, 
    message_id, 
    timestamp, 
    metadata
  FROM temp_memories;
  
  -- Reset the sequence to continue after the highest existing ID
  PERFORM setval('memories_id_seq', COALESCE((SELECT MAX(id) FROM memories), 0) + 1, false);
END $$;