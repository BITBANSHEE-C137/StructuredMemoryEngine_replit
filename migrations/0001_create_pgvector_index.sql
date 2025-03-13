-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- First, drop the existing index that's causing problems
DROP INDEX IF EXISTS embedding_idx;

-- Now create a proper index for vector similarity search
ALTER TABLE memories ALTER COLUMN embedding TYPE vector USING embedding::vector;
