-- Make sure pgvector extension is installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a new temporary table with correct vector type
CREATE TEMPORARY TABLE temp_memories (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NULL,
  type TEXT NOT NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  metadata JSONB
);

-- Insert existing data with proper vector conversion
INSERT INTO temp_memories (id, content, embedding, type, message_id, timestamp, metadata)
SELECT 
  m.id, 
  m.content, 
  CASE 
    WHEN m.embedding IS NOT NULL AND m.embedding != '' 
    THEN CASE 
      WHEN m.embedding LIKE '[%]' THEN m.embedding::vector 
      ELSE NULL 
    END
    ELSE NULL
  END as embedding,
  m.type, 
  m.message_id, 
  m.timestamp, 
  m.metadata
FROM memories m;

-- Drop original table
DROP TABLE IF EXISTS memories CASCADE;

-- Recreate the memories table with proper vector type
CREATE TABLE memories (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NULL,
  type TEXT NOT NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  metadata JSONB
);

-- Reinsert the data
INSERT INTO memories
SELECT * FROM temp_memories;

-- Drop temporary table
DROP TABLE temp_memories;

-- Create vector index
CREATE INDEX IF NOT EXISTS embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops);