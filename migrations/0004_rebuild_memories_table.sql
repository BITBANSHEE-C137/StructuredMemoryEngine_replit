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
END $$;