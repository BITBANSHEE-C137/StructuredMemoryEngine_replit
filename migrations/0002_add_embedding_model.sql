-- Add embedding model to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_embedding_model_id TEXT NOT NULL DEFAULT 'text-embedding-ada-002';