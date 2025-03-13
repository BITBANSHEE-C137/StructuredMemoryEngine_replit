/**
 * Pinecone settings file
 * 
 * This file provides constants and defaults for Pinecone operations
 * to ensure consistency across the application. For a PoC, we're
 * standardizing on a single namespace to avoid complexity.
 */

// Use 'default' namespace consistently across all operations
export const DEFAULT_NAMESPACE = 'default';

// Dimension for OpenAI embeddings
export const DEFAULT_DIMENSION = 1536;

// Default metric for vector similarity  
export const DEFAULT_METRIC = 'cosine';

// Default batch size for Pinecone operations
export const DEFAULT_BATCH_SIZE = 100;

// Default limit for vector fetch operations
export const DEFAULT_VECTOR_LIMIT = 1000;

// Default region for Pinecone serverless indexes
export const DEFAULT_REGION = 'us-east-1';