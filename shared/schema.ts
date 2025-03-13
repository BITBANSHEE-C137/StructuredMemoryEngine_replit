import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

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
export const memories = pgTable(
  "memories", 
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    embedding: text("embedding").notNull(), // will be cast to vector in queries
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
  defaultModelId: text("default_model_id").default("gpt-4o").notNull(),
  defaultEmbeddingModelId: text("default_embedding_model_id").default("text-embedding-ada-002").notNull(),
  autoClearMemories: boolean("auto_clear_memories").default(false).notNull(),
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
