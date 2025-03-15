import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { createHash } from 'crypto';

// Base users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Messages table for storing chat messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  role: text("role").notNull(), // user or assistant
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  modelId: text("model_id").notNull(), // ID of the model used for generation
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  role: true,
  modelId: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Memory table for storing embeddings
// Create a vector data type for pgvector with explicit dimensions for OpenAI embeddings
const vector = customType<{ data: string }>({
  dataType() {
    // Use vector(1536) for OpenAI embedding dimensions
    return 'vector(1536)';
  },
});

export const memories = pgTable(
  "memories", 
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    embedding: vector("embedding").notNull(), // Vector type for OpenAI embeddings (1536 dimensions)
    type: text("type").notNull(), // prompt, response, etc.
    messageId: integer("message_id").references(() => messages.id, { onDelete: 'cascade' }),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    metadata: jsonb("metadata"), // Additional data about the memory
  }
);

export const insertMemorySchema = createInsertSchema(memories).pick({
  content: true,
  embedding: true,
  type: true,
  messageId: true,
  metadata: true,
});

export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memories.$inferSelect;

// Settings table for storing user preferences
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  contextSize: integer("context_size").default(5).notNull(),
  similarityThreshold: text("similarity_threshold").default("0.75").notNull(),
  // Threshold adjustment factors for different query types
  questionThresholdFactor: text("question_threshold_factor").default("0.7").notNull(),
  statementThresholdFactor: text("statement_threshold_factor").default("0.85").notNull(),
  defaultModelId: text("default_model_id").default("gpt-4o").notNull(),
  defaultEmbeddingModelId: text("default_embedding_model_id").default("text-embedding-ada-002").notNull(),
  // Removed autoClearMemories option - replaced with manual memory management
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Models table for available LLM models
export const models = pgTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // openai, anthropic, etc.
  maxTokens: integer("max_tokens").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
});

export const insertModelSchema = createInsertSchema(models).pick({
  id: true,
  name: true,
  provider: true,
  maxTokens: true,
  isEnabled: true,
});

export type InsertModel = z.infer<typeof insertModelSchema>;
export type Model = typeof models.$inferSelect;

// Pinecone integration settings
export const pineconeSettings = pgTable("pinecone_settings", {
  id: serial("id").primaryKey(),
  activeIndexName: text("active_index_name"),
  vectorDimension: integer("vector_dimension").default(1536).notNull(),
  namespace: text("namespace").default("default").notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  lastSyncTimestamp: timestamp("last_sync_timestamp"),
  metadata: jsonb("metadata"), // Store operation results and metrics
});

export const insertPineconeSettingsSchema = createInsertSchema(pineconeSettings).omit({
  id: true,
}).extend({
  // Make sure metadata is properly typed as an optional JSON field
  metadata: z.record(z.any()).optional(),
});

export type InsertPineconeSettings = z.infer<typeof insertPineconeSettingsSchema>;
export type PineconeSettings = typeof pineconeSettings.$inferSelect;

/**
 * Creates a consistent and unique hash-based ID for a memory object
 * Used for deduplication and consistency when upserting to Pinecone
 */
export function memoryIdForUpsert(memory: Memory): string {
  // Create a string combining only content and type for effective deduplication
  // Important: Do NOT include unique IDs or timestamps in this string
  const contentNormalized = memory.content.trim().toLowerCase();
  const uniqueString = `${contentNormalized}_${memory.type}`;
  
  // Generate a hash to use as the ID
  const hash = createHash('sha256').update(uniqueString).digest('hex');
  
  // Return a deduplication hash that doesn't include the memory ID
  // This ensures identical content generates the same hash
  return `dedup_${hash.substring(0, 16)}`;
}
