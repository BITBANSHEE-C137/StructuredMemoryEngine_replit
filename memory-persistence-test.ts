/**
 * Memory Persistence Test
 * This script tests the entire memory creation and persistence pipeline
 */

import { db } from "./server/db";
import { storage } from "./server/storage";
import { generateEmbedding } from "./server/utils/openai";
import { sql } from "drizzle-orm";
import { memories, messages } from "./shared/schema";

async function verifyDatabaseState() {
  // Check current state of messages and memories
  const msgCount = await db.select({ count: sql`count(*)` }).from(messages);
  const memCount = await db.select({ count: sql`count(*)` }).from(memories);
  
  console.log(`Database state: ${msgCount[0].count} messages, ${memCount[0].count} memories`);
  
  // Get latest message
  const latestMessages = await db.select().from(messages).orderBy(sql`id DESC`).limit(1);
  if (latestMessages.length > 0) {
    console.log(`Latest message: ID=${latestMessages[0].id}, Content="${latestMessages[0].content.substring(0, 50)}..."`);
  }
  
  // Get latest memory
  const latestMemories = await db.select().from(memories).orderBy(sql`id DESC`).limit(1);
  if (latestMemories.length > 0) {
    console.log(`Latest memory: ID=${latestMemories[0].id}, Content="${latestMemories[0].content.substring(0, 50)}..."`);
    console.log(`Memory metadata: ${JSON.stringify(latestMemories[0].metadata)}`);
    console.log(`Memory messageId: ${latestMemories[0].messageId}`);
  } else {
    console.log("No memories found in database!");
  }
}

async function directDatabaseInsert() {
  try {
    console.log("Attempting direct database insert of memory...");
    
    // 1. Create a test message first through direct SQL
    const [messageResult] = await db.execute(sql`
      INSERT INTO messages (content, role, model_id)
      VALUES ('Direct SQL test message', 'user', 'gpt-4o')
      RETURNING *
    `);
    
    console.log(`Created message with ID: ${messageResult.id}`);
    
    // 2. Generate an embedding
    const content = "This is a test memory inserted through direct SQL";
    const embedding = await generateEmbedding(content);
    console.log(`Generated embedding length: ${embedding.length}`);
    
    // 3. Insert memory with direct SQL
    const [memoryResult] = await db.execute(sql`
      INSERT INTO memories (content, embedding, type, message_id, metadata)
      VALUES (
        ${content},
        ${embedding},
        ${'prompt'},
        ${messageResult.id},
        ${JSON.stringify({ source: 'direct-sql-test' })}::jsonb
      )
      RETURNING *
    `);
    
    console.log(`Created memory with ID: ${memoryResult.id}`);
    
    // 4. Verify persistence immediately after insert
    await verifyMemoryExists(Number(memoryResult.id));
    
    return { messageId: Number(messageResult.id), memoryId: Number(memoryResult.id) };
  } catch (error) {
    console.error("Direct insert failed:", error);
    throw error;
  }
}

async function storageLayerInsert() {
  try {
    console.log("\nAttempting storage layer insert of memory...");
    
    // 1. Create a test message through storage layer
    const message = await storage.createMessage({
      content: 'Storage layer test message',
      role: 'user',
      modelId: 'gpt-4o'
    });
    
    console.log(`Created message with ID: ${message.id}`);
    
    // 2. Generate an embedding
    const content = "This is a test memory inserted through storage layer";
    const embedding = await generateEmbedding(content);
    console.log(`Generated embedding length: ${embedding.length}`);
    
    // 3. Insert memory through storage layer
    const memory = await storage.createMemory({
      content,
      embedding,
      type: 'prompt',
      messageId: message.id,
      metadata: { source: 'storage-layer-test' }
    });
    
    console.log(`Created memory with ID: ${memory.id}`);
    
    // 4. Verify persistence immediately after insert
    await verifyMemoryExists(memory.id);
    
    return { messageId: message.id, memoryId: memory.id };
  } catch (error) {
    console.error("Storage layer insert failed:", error);
    throw error;
  }
}

async function verifyMemoryExists(memoryId: number) {
  console.log(`Verifying memory ID ${memoryId} exists...`);
  
  // Check through storage layer
  const storageMemory = await storage.getMemoryById(memoryId);
  console.log(`Storage layer retrieval: ${storageMemory ? "SUCCESS" : "FAILED"}`);
  
  // Check through direct DB query
  const [directMemory] = await db.select().from(memories).where(sql`id = ${memoryId}`);
  console.log(`Direct DB retrieval: ${directMemory ? "SUCCESS" : "FAILED"}`);
  
  // Try vector similarity search
  if (storageMemory) {
    const similar = await storage.queryMemoriesByEmbedding(storageMemory.embedding, 5, 0.7);
    console.log(`Vector search found ${similar.length} results`);
    if (similar.length > 0) {
      console.log(`First result ID: ${similar[0].id}, similarity: ${similar[0].similarity}`);
    }
  }
}

async function main() {
  try {
    console.log("=== MEMORY PERSISTENCE TEST ===");
    console.log("Checking initial database state...");
    await verifyDatabaseState();
    
    // Test both direct database insert and storage layer insert
    const directResult = await directDatabaseInsert();
    
    console.log("\nVerifying database state after direct insert...");
    await verifyDatabaseState();
    
    const storageResult = await storageLayerInsert();
    
    console.log("\nVerifying final database state...");
    await verifyDatabaseState();
    
    // Final verification after both inserts
    console.log("\nFinal verification of both inserted memories:");
    await verifyMemoryExists(directResult.memoryId);
    await verifyMemoryExists(storageResult.memoryId);
    
    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
}

main();