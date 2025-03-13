import { 
  users, type User, type InsertUser, 
  messages, type Message, type InsertMessage,
  memories, type Memory, type InsertMemory,
  settings, type Settings, type InsertSettings,
  models, type Model,
  pineconeSettings, type PineconeSettings, type InsertPineconeSettings,
  memoryIdForUpsert
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, asc } from "drizzle-orm";
import { 
  getPineconeClient, 
  isPineconeAvailable as checkPineconeAvailable,
  upsertMemoriesToPinecone,
  fetchVectorsFromPinecone,
  listPineconeIndexes
} from "./utils/pinecone";

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
  queryMemoriesByEmbedding(embedding: string, limit?: number, similarityThreshold?: number): Promise<(Memory & { similarity: number })[]>;
  clearAllMemories(): Promise<{ count: number }>; // Method to clear all memories
  getMemories(page?: number, pageSize?: number): Promise<{ memories: Memory[], total: number }>; // Method to get paginated memories
  
  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  // Model operations
  getModels(): Promise<Model[]>;
  getEnabledModels(): Promise<Model[]>;
  getModelById(id: string): Promise<Model | undefined>;
  createModel(model: { id: string; name: string; provider: 'openai' | 'anthropic'; maxTokens: number; isEnabled: boolean }): Promise<Model>;
  updateModel(id: string, data: Partial<Omit<Model, "id">>): Promise<Model>;
  
  // Pinecone operations
  getPineconeSettings(): Promise<PineconeSettings>;
  updatePineconeSettings(settings: Partial<InsertPineconeSettings>): Promise<PineconeSettings>;
  syncMemoriesToPinecone(indexName: string, namespace?: string): Promise<{ 
    success: boolean; 
    count: number; 
    duplicateCount?: number; 
    dedupRate?: number; 
    totalProcessed?: number;
    vectorCount?: number;
    indexName?: string;
    namespace?: string;
    timestamp?: string;
  }>;
  hydrateFromPinecone(indexName: string, namespace?: string, limit?: number): Promise<{ 
    success: boolean; 
    count: number; 
    duplicateCount?: number; 
    dedupRate?: number;
    totalProcessed?: number;
    vectorCount?: number;
    indexName?: string;
    namespace?: string;
    timestamp?: string;
  }>;
  isPineconeAvailable(): Promise<boolean>;
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
    // Return messages in chronological order (oldest first)
    // This way, they can be rendered in the UI in the same order
    return await db.select()
      .from(messages)
      .orderBy(asc(messages.timestamp))
      .limit(limit);
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
      
      // Handle foreign key constraint violation
      if (error.code === '23503' && error.detail?.includes('message_id')) {
        console.log(`Foreign key constraint error on messageId: ${insertMemory.messageId}`);
        
        // Create a placeholder message to satisfy the constraint
        console.log(`Creating placeholder message for memory with foreign key constraint issue`);
        const message = await this.createMessage({
          content: `Imported memory from external source`,
          role: insertMemory.type === 'prompt' ? 'user' : 'assistant',
          modelId: 'unknown'
        });
        
        // Try again with the newly created message ID
        console.log(`Retrying memory creation with new messageId: ${message.id}`);
        const [memory] = await db.execute(sql`
          INSERT INTO memories (content, embedding, type, message_id, metadata)
          VALUES (
            ${insertMemory.content},
            ${insertMemory.embedding},
            ${insertMemory.type},
            ${message.id},
            ${insertMemory.metadata ? JSON.stringify({
              ...JSON.parse(JSON.stringify(insertMemory.metadata)),
              originalMessageId: insertMemory.messageId,
              importedWithPlaceholder: true
            }) : JSON.stringify({
              originalMessageId: insertMemory.messageId,
              importedWithPlaceholder: true
            })}::jsonb
          )
          RETURNING *
        `);
        
        // Convert the raw result to a Memory object
        return {
          id: Number(memory.id),
          content: String(memory.content),
          embedding: String(memory.embedding),
          type: memory.type as 'prompt' | 'response',
          messageId: message.id,
          timestamp: memory.timestamp as Date,
          metadata: memory.metadata
        };
      }
      
      throw error;
    }
  }

  async getMemoryById(id: number): Promise<Memory | undefined> {
    const [memory] = await db.select().from(memories).where(eq(memories.id, id));
    return memory;
  }

  async queryMemoriesByEmbedding(embedding: string, limit: number = 5, similarityThreshold: number = 0.5): Promise<(Memory & { similarity: number })[]> {
    try {
      // Make sure similarityThreshold is a proper number between 0 and 1
      const threshold = Math.min(1, Math.max(0, similarityThreshold));
      
      console.log(`Querying memories with similarityThreshold: ${threshold} (${threshold * 100}%)`);
      
      // Ensure embedding is cast as vector and using the cosine distance operator (<->)
      // Added filtering by similarity threshold
      const result = await db.execute(sql`
        SELECT m.*, 
               1 - (m.embedding <-> ${embedding}::vector) as similarity
        FROM memories m
        WHERE m.embedding IS NOT NULL
        AND 1 - (m.embedding <-> ${embedding}::vector) >= ${threshold}
        ORDER BY m.embedding <-> ${embedding}::vector
        LIMIT ${limit}
      `);
      
      console.log(`Successfully found ${result.length} relevant memories with similarity >= ${threshold}`);
      
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
  
  // Method to clear all memories and messages
  async clearAllMemories(): Promise<{ count: number }> {
    try {
      // First delete all memories from the database
      const memoriesResult = await db.delete(memories);
      
      // Then delete all messages from the database
      const messagesResult = await db.delete(messages);
      
      // Return the count of deleted items
      const totalDeleted = Number(memoriesResult.length) + Number(messagesResult.length);
      
      return { 
        count: totalDeleted
      };
    } catch (error) {
      console.error("Error clearing memories and messages:", error);
      throw error;
    }
  }
  
  // Get all memories with pagination
  async getMemories(page: number = 1, pageSize: number = 10): Promise<{ memories: Memory[], total: number }> {
    try {
      // Calculate offset based on page and pageSize
      const offset = (page - 1) * pageSize;
      
      // Get total count first
      const [{ count }] = await db.select({ count: sql`count(*)` }).from(memories);
      
      // Get memories with pagination
      const result = await db
        .select()
        .from(memories)
        .orderBy(desc(memories.timestamp))
        .limit(pageSize)
        .offset(offset);
      
      return { 
        memories: result,
        total: Number(count)
      };
    } catch (error) {
      console.error("Error fetching memories:", error);
      throw error;
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
        defaultEmbeddingModelId: "text-embedding-ada-002"
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

  // Pinecone operations
  async getPineconeSettings(): Promise<PineconeSettings> {
    // Get the first pinecone settings record or create default if none exists
    const existingSettings = await db.select().from(pineconeSettings).limit(1);
    
    if (existingSettings.length > 0) {
      return {
        ...existingSettings[0],
        // Initialize metadata as empty object if it doesn't exist
        metadata: existingSettings[0].metadata || {}
      };
    } else {
      // Create default pinecone settings with empty metadata
      const [newSettings] = await db.insert(pineconeSettings).values({
        isEnabled: false,
        vectorDimension: 1536,
        namespace: 'default',
        metadata: {}
      }).returning();
      
      return newSettings;
    }
  }

  async updatePineconeSettings(updatedSettings: Partial<InsertPineconeSettings>): Promise<PineconeSettings> {
    const currentSettings = await this.getPineconeSettings();
    
    // Handle metadata merging
    let mergedMetadata = currentSettings.metadata;
    if (updatedSettings.metadata) {
      mergedMetadata = {
        ...mergedMetadata,
        ...updatedSettings.metadata
      };
    }
    
    // Update settings with the new values
    const [updated] = await db.update(pineconeSettings)
      .set({
        ...updatedSettings,
        metadata: mergedMetadata,
        lastSyncTimestamp: updatedSettings.lastSyncTimestamp || new Date()
      })
      .where(eq(pineconeSettings.id, currentSettings.id))
      .returning();
    
    return updated;
  }

  async syncMemoriesToPinecone(indexName: string, namespace: string = 'default'): Promise<{ 
    success: boolean; 
    count: number;
    duplicateCount?: number; 
    dedupRate?: number; 
    totalProcessed?: number;
    vectorCount?: number;
    indexName?: string;
    namespace?: string;
    timestamp?: string;
  }> {
    try {
      // Check if Pinecone is available
      const isPineconeActive = await this.isPineconeAvailable();
      if (!isPineconeActive) {
        throw new Error('Pinecone is not available. Check API key and connection.');
      }

      // Get all memories from pgvector
      const { memories: pgvectorMemories } = await this.getMemories(1, 1000); // Get first 1000 memories
      
      if (pgvectorMemories.length === 0) {
        return { 
          success: true, 
          count: 0,
          duplicateCount: 0,
          dedupRate: 0,
          totalProcessed: 0,
          vectorCount: 0,
          indexName,
          namespace,
          timestamp: new Date().toISOString()
        };
      }

      // Sync memories to Pinecone with enhanced deduplication tracking
      const result = await upsertMemoriesToPinecone(pgvectorMemories, indexName, namespace);
      
      // Store the sync result in the settings metadata for future reference
      const currentSettings = await this.getPineconeSettings();
      const metadata = currentSettings.metadata ? { ...currentSettings.metadata } : {};
      
      // Add the sync result to metadata
      metadata.lastSyncResult = {
        count: result.count,
        duplicateCount: result.duplicateCount,
        dedupRate: result.dedupRate,
        totalProcessed: result.totalProcessed,
        vectorCount: result.vectorCount,
        timestamp: result.timestamp || new Date().toISOString()
      };
      
      // Update the settings with result and last sync timestamp
      await this.updatePineconeSettings({
        activeIndexName: indexName,
        namespace,
        isEnabled: true,
        lastSyncTimestamp: new Date(),
        metadata
      });
      
      // Return comprehensive response with all sync statistics
      // Make sure we're passing through exactly what upsertMemoriesToPinecone returns
      return {
        success: result.success,
        count: result.count,
        duplicateCount: result.duplicateCount,
        dedupRate: result.dedupRate,
        totalProcessed: result.totalProcessed,
        vectorCount: result.vectorCount,
        indexName: result.indexName || indexName,
        namespace: result.namespace || namespace,
        timestamp: result.timestamp || new Date().toISOString()
      };
    } catch (error) {
      console.error("Error syncing memories to Pinecone:", error);
      throw error;
    }
  }

  async hydrateFromPinecone(indexName: string, namespace: string = 'default', limit: number = 1000): Promise<{ 
    success: boolean; 
    count: number;
    duplicateCount?: number;
    dedupRate?: number;
    totalProcessed?: number;
    vectorCount?: number;
    indexName?: string;
    namespace?: string;
    timestamp?: string;
  }> {
    try {
      console.log(`Starting hydration from Pinecone index ${indexName}, namespace ${namespace}, limit ${limit}`);
      
      // Check if Pinecone is available
      const isPineconeActive = await this.isPineconeAvailable();
      console.log(`Pinecone availability check: ${isPineconeActive}`);
      
      if (!isPineconeActive) {
        console.error('Pinecone is not available. Check API key and connection.');
        throw new Error('Pinecone is not available. Check API key and connection.');
      }
      
      // Verify the index exists and has vectors
      try {
        console.log(`Verifying index ${indexName} exists and has vectors...`);
        const indexes = await listPineconeIndexes();
        const targetIndex = indexes.find(idx => idx.name === indexName);
        
        if (!targetIndex) {
          throw new Error(`Index ${indexName} does not exist in Pinecone`);
        }
        
        if (targetIndex.vectorCount === 0) {
          console.log(`Index ${indexName} exists but contains no vectors. Nothing to hydrate.`);
          return { 
            success: true, 
            count: 0,
            duplicateCount: 0,
            dedupRate: 0,
            totalProcessed: 0,
            vectorCount: 0,
            indexName,
            namespace,
            timestamp: new Date().toISOString()
          };
        }
        
        console.log(`Index ${indexName} found with ${targetIndex.vectorCount} vectors total`);
      } catch (indexError) {
        console.error(`Error verifying index: ${indexError}`);
        // Continue anyway as we'll try to fetch directly
      }

      // Important: We're no longer clearing all memories before hydrating
      // This preserves local memories and just merges in Pinecone data
      console.log('Preserving local memories and merging Pinecone data');

      // Fetch vectors from Pinecone
      console.log(`Fetching vectors from Pinecone index ${indexName}, namespace ${namespace}`);
      const pineconeVectors = await fetchVectorsFromPinecone(indexName, namespace, limit);
      console.log(`Fetched ${pineconeVectors.length} vectors from Pinecone`);
      
      if (pineconeVectors.length === 0) {
        console.log('No vectors found in Pinecone, nothing to hydrate');
        return { 
          success: true, 
          count: 0,
          duplicateCount: 0,
          dedupRate: 0,
          totalProcessed: 0,
          vectorCount: 0,
          indexName,
          namespace,
          timestamp: new Date().toISOString()
        };
      }

      // Insert each memory into pgvector
      let successCount = 0;
      let duplicateCount = 0;
      let totalProcessed = pineconeVectors.length;
      
      // Keep track of created message IDs to handle foreign key references
      const createdMessageMap = new Map<number, number>();
      
      // Track duplicate detection by content hash
      const existingMemoryHashes = new Set<string>();
      
      // First, build a set of existing memory hashes for deduplication
      try {
        console.log('Gathering existing memory hashes for deduplication detection');
        const { memories: existingMemories } = await this.getMemories(1, 1000);
        
        for (const memory of existingMemories) {
          // Generate a hash based on content to detect duplicates
          const contentHash = memoryIdForUpsert(memory);
          existingMemoryHashes.add(contentHash);
        }
        
        console.log(`Found ${existingMemoryHashes.size} existing memories to check for duplicates`);
      } catch (hashError) {
        console.error(`Error gathering existing memory hashes: ${hashError}`);
        // Continue without deduplication if this fails
      }
      
      console.log(`Starting to process ${pineconeVectors.length} vectors from Pinecone`);
      for (const vector of pineconeVectors) {
        try {
          console.log(`Processing vector ID: ${vector.id}`);
          const metadata = vector.metadata || {};
          console.log(`Vector metadata: ${JSON.stringify(metadata)}`);
          
          // Handle message_id foreign key constraint
          let messageId: number | null = null;
          
          // Case 1: messageId exists in metadata 
          if (metadata.messageId) {
            // Check if we've already created a replacement for this message ID
            if (createdMessageMap.has(metadata.messageId)) {
              messageId = createdMessageMap.get(metadata.messageId)!;
              console.log(`Using previously created message ID ${messageId} for reference to ${metadata.messageId}`);
            } else {
              // Check if the message exists in the database
              try {
                const existingMessage = await this.getMessageById(metadata.messageId);
                if (existingMessage) {
                  messageId = existingMessage.id;
                  console.log(`Message ID ${messageId} exists in database, using it`);
                } else {
                  // Create a placeholder message since original doesn't exist
                  console.log(`Message ID ${metadata.messageId} doesn't exist, creating placeholder message`);
                  const placeholderContent = metadata.content || `Placeholder for message ID ${metadata.messageId}`;
                  const message = await this.createMessage({
                    content: placeholderContent,
                    role: metadata.type === 'prompt' ? 'user' : 'assistant',
                    modelId: metadata.modelId || 'unknown'
                  });
                  messageId = message.id;
                  createdMessageMap.set(metadata.messageId, messageId);
                  console.log(`Created placeholder message with ID: ${messageId} for original ID: ${metadata.messageId}`);
                }
              } catch (msgErr) {
                console.log(`Error checking message, creating new placeholder: ${msgErr}`);
                // Create a placeholder message
                const placeholderContent = metadata.content || `Placeholder for message ID ${metadata.messageId}`;
                const message = await this.createMessage({
                  content: placeholderContent,
                  role: metadata.type === 'prompt' ? 'user' : 'assistant',
                  modelId: metadata.modelId || 'unknown'
                });
                messageId = message.id;
                createdMessageMap.set(metadata.messageId, messageId);
                console.log(`Created placeholder message with ID: ${messageId} for original ID: ${metadata.messageId}`);
              }
            }
          } 
          // Case 2: No messageId but content exists
          else if (metadata.content) {
            console.log(`Creating new message for content: ${metadata.content.substring(0, 50)}...`);
            const message = await this.createMessage({
              content: metadata.content,
              role: metadata.type === 'prompt' ? 'user' : 'assistant',
              modelId: metadata.modelId || 'unknown'
            });
            messageId = message.id;
            console.log(`Created new message with ID: ${messageId}`);
          }
          // Case 3: No messageId and no content - create a basic placeholder
          else {
            console.log(`Creating generic placeholder message for vector without content`);
            const message = await this.createMessage({
              content: `Imported memory from Pinecone index: ${indexName}`,
              role: metadata.type === 'prompt' ? 'user' : 'assistant',
              modelId: metadata.modelId || 'unknown'
            });
            messageId = message.id;
            console.log(`Created generic placeholder message with ID: ${messageId}`);
          }
          
          // Create memory in pgvector with our valid message ID
          console.log(`Creating/updating memory in local database, embedding length: ${vector.values.length}`);
          
          // Ensure memory content exists
          const memoryContent = metadata.content || `Memory imported from Pinecone index: ${indexName}`;
          
          // Create a temp memory object to check for duplication
          const tempMemory: Memory = {
            id: -1, // Temporary ID for hash calculation
            content: memoryContent,
            embedding: JSON.stringify(vector.values),
            type: metadata.type || 'prompt',
            messageId: messageId,
            timestamp: new Date(),
            metadata: {
              ...(metadata.metadata || {}),
              importedFrom: indexName,
              originalMessageId: metadata.messageId || null
            }
          };
          
          // Check for duplicates based on content hash
          const contentHash = memoryIdForUpsert(tempMemory);
          
          if (existingMemoryHashes.has(contentHash)) {
            console.log(`Skipping duplicate memory with hash: ${contentHash}`);
            duplicateCount++;
          } else {
            // Not a duplicate, so create it in the database
            const memory = await this.createMemory({
              content: memoryContent,
              embedding: JSON.stringify(vector.values),
              type: metadata.type || 'prompt',
              messageId: messageId,
              metadata: {
                ...(metadata.metadata || {}),
                importedFrom: indexName,
                originalMessageId: metadata.messageId || null,
                importTimestamp: new Date().toISOString(),
                contentHash // Store the hash for future reference
              }
            });
            console.log(`Created memory with ID: ${memory.id}`);
            
            // Add to hash set to prevent future duplicates in this batch
            existingMemoryHashes.add(contentHash);
            successCount++;
          }
        } catch (err) {
          console.error(`Error hydrating memory from Pinecone:`, err);
          // Continue with next vector even if one fails
        }
      }
      
      console.log(`Successfully hydrated ${successCount} memories from Pinecone`);
      
      // Calculate deduplication rate
      const dedupRate = totalProcessed > 0 ? duplicateCount / totalProcessed : 0;
      const dedupRatePercent = parseFloat((dedupRate * 100).toFixed(2));
      
      // Get final vector count for reporting
      let finalVectorCount = 0;
      try {
        const indexes = await listPineconeIndexes();
        const targetIndex = indexes.find(idx => idx.name === indexName);
        if (targetIndex) {
          finalVectorCount = targetIndex.vectorCount;
        }
      } catch (error) {
        console.error("Error getting final vector count:", error);
      }
      
      // Store the hydrate result in the settings metadata for future reference
      const currentSettings = await this.getPineconeSettings();
      const metadataObj = typeof currentSettings.metadata === 'object' && currentSettings.metadata !== null 
        ? { ...currentSettings.metadata as object } 
        : {};
      
      // Add the hydrate result to metadata
      (metadataObj as any).lastHydrateResult = {
        count: successCount,
        duplicateCount,
        dedupRate: dedupRatePercent,
        totalProcessed,
        vectorCount: finalVectorCount,
        timestamp: new Date().toISOString()
      };
      
      // Update the pinecone settings with metadata
      console.log(`Updating Pinecone settings to reflect successful hydration`);
      await this.updatePineconeSettings({
        activeIndexName: indexName,
        namespace,
        isEnabled: true,
        lastSyncTimestamp: new Date(),
        metadata: metadataObj as any
      });
      
      console.log(`Hydration from Pinecone completed successfully`);
      console.log(`Deduplication stats: ${duplicateCount} duplicates out of ${totalProcessed} total vectors (${dedupRatePercent}%)`);
      
      const timestamp = new Date().toISOString();
      
      return { 
        success: true, 
        count: successCount,
        duplicateCount,
        dedupRate: dedupRatePercent,
        totalProcessed,
        vectorCount: finalVectorCount,
        indexName,
        namespace,
        timestamp
      };
    } catch (error) {
      console.error("Error hydrating from Pinecone:", error);
      throw error;
    }
  }

  async isPineconeAvailable(): Promise<boolean> {
    return await checkPineconeAvailable();
  }
}

// Export the storage instance
export const storage = new DatabaseStorage();
