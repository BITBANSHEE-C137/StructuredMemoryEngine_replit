import { 
  users, type User, type InsertUser, 
  messages, type Message, type InsertMessage,
  memories, type Memory, type InsertMemory,
  settings, type Settings, type InsertSettings,
  models, type Model
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, asc } from "drizzle-orm";

// Define the storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(limit?: number): Promise<Message[]>;
  getMessageById(id: number): Promise<Message | undefined>;

  // Memory operations
  createMemory(memory: InsertMemory): Promise<Memory>;
  getMemoryById(id: number): Promise<Memory | undefined>;
  queryMemoriesByEmbedding(embedding: string, limit?: number): Promise<(Memory & { similarity: number })[]>;
  
  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  // Model operations
  getModels(): Promise<Model[]>;
  getEnabledModels(): Promise<Model[]>;
  getModelById(id: string): Promise<Model | undefined>;
  createModel(model: { id: string; name: string; provider: 'openai' | 'anthropic'; maxTokens: number; isEnabled: boolean }): Promise<Model>;
  updateModel(id: string, data: Partial<Omit<Model, "id">>): Promise<Model>;
}

// Implement the database storage
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Message operations
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async getMessages(limit: number = 100): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.timestamp)).limit(limit);
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  // Memory operations
  async createMemory(insertMemory: InsertMemory): Promise<Memory> {
    try {
      // Use SQL to ensure embedding is properly cast to vector
      // We explicitly use the vector dimensions and ensure proper casting
      const [memory] = await db.execute(sql`
        INSERT INTO memories (content, embedding, type, message_id, metadata)
        VALUES (
          ${insertMemory.content},
          ${insertMemory.embedding},
          ${insertMemory.type},
          ${insertMemory.messageId},
          ${insertMemory.metadata ? JSON.stringify(insertMemory.metadata) : null}::jsonb
        )
        RETURNING *
      `);
      
      // Convert the raw result to a Memory object
      return {
        id: Number(memory.id),
        content: String(memory.content),
        embedding: String(memory.embedding),
        type: memory.type as 'prompt' | 'response',
        messageId: memory.message_id ? Number(memory.message_id) : null,
        timestamp: memory.timestamp as Date,
        metadata: memory.metadata
      };
    } catch (error) {
      console.error("Error creating memory:", error);
      throw error;
    }
  }

  async getMemoryById(id: number): Promise<Memory | undefined> {
    const [memory] = await db.select().from(memories).where(eq(memories.id, id));
    return memory;
  }

  async queryMemoriesByEmbedding(embedding: string, limit: number = 5): Promise<(Memory & { similarity: number })[]> {
    try {
      console.log("Input embedding format:", embedding.substring(0, 50) + "...");
      
      // Ensure embedding is cast as vector and using the cosine distance operator (<->)
      const result = await db.execute(sql`
        SELECT m.*, 
               1 - (m.embedding <-> ${embedding}::vector) as similarity
        FROM memories m
        WHERE m.embedding IS NOT NULL
        ORDER BY m.embedding <-> ${embedding}::vector
        LIMIT ${limit}
      `);
      
      console.log(`Successfully found ${result.length} relevant memories`);
      
      // Convert the raw result to Memory objects with similarity score
      return result.map(row => ({
        id: Number(row.id),
        content: String(row.content),
        embedding: String(row.embedding),
        type: String(row.type),
        messageId: row.message_id ? Number(row.message_id) : null,
        timestamp: row.timestamp as Date,
        metadata: row.metadata,
        similarity: parseFloat(String(row.similarity) || '0')
      }));
    } catch (error) {
      console.error("Error querying memories by embedding:", error);
      
      // Try fallback to basic query without vector operations
      try {
        console.log("Trying fallback query...");
        const fallbackResult = await db.select().from(memories).limit(limit);
        
        return fallbackResult.map(row => ({
          ...row,
          similarity: 0.5 // Default similarity for fallback results
        }));
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        return []; // Return empty array as last resort
      }
    }
  }

  // Settings operations
  async getSettings(): Promise<Settings> {
    // Get the first settings record or create default settings if none exists
    const existingSettings = await db.select().from(settings).limit(1);
    
    if (existingSettings.length > 0) {
      return existingSettings[0];
    } else {
      // Create default settings
      const [newSettings] = await db.insert(settings).values({
        contextSize: 5,
        similarityThreshold: "0.75",
        defaultModelId: "gpt-3.5-turbo",
        autoClearMemories: false
      }).returning();
      
      return newSettings;
    }
  }

  async updateSettings(updatedSettings: Partial<InsertSettings>): Promise<Settings> {
    const currentSettings = await this.getSettings();
    
    const [updated] = await db.update(settings)
      .set(updatedSettings)
      .where(eq(settings.id, currentSettings.id))
      .returning();
    
    return updated;
  }

  // Model operations
  async getModels(): Promise<Model[]> {
    return await db.select().from(models);
  }

  async getEnabledModels(): Promise<Model[]> {
    return await db.select().from(models).where(eq(models.isEnabled, true));
  }

  async getModelById(id: string): Promise<Model | undefined> {
    const [model] = await db.select().from(models).where(eq(models.id, id));
    return model;
  }
  
  async createModel(modelData: { id: string; name: string; provider: 'openai' | 'anthropic'; maxTokens: number; isEnabled: boolean }): Promise<Model> {
    const [model] = await db.insert(models).values(modelData).returning();
    return model;
  }

  async updateModel(id: string, data: Partial<Omit<Model, "id">>): Promise<Model> {
    const [updated] = await db.update(models)
      .set(data)
      .where(eq(models.id, id))
      .returning();
    
    return updated;
  }
}

// Export the storage instance
export const storage = new DatabaseStorage();
