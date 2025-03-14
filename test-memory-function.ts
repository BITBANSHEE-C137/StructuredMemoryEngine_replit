/**
 * Test script to verify memory creation with message_id foreign key constraint
 */

import { db } from "./server/db";
import { storage } from "./server/storage";
import { generateEmbedding } from "./server/utils/openai";
import { sql } from "drizzle-orm";
import { memories, messages } from "./shared/schema";

/**
 * Main test function to create a test message and memory
 */
async function testMemoryFunctionality() {
  console.log("=== MEMORY FUNCTIONALITY TEST ===");
  
  try {
    // 1. Check if any messages or memories exist in the database
    const messageCount = await db.select({ count: sql`count(*)` }).from(messages);
    console.log(`Existing messages in database: ${messageCount[0].count}`);
    
    const memoryCount = await db.select({ count: sql`count(*)` }).from(memories);
    console.log(`Existing memories in database: ${memoryCount[0].count}`);
    
    // 2. Create a test message
    console.log("\nCreating a test message...");
    const message = await storage.createMessage({
      content: "This is a test message for memory functionality",
      role: "user",
      modelId: "gpt-4o"
    });
    console.log(`Successfully created message with ID: ${message.id}`);
    
    // 3. Generate an embedding for the test memory
    console.log("\nGenerating embedding for test memory...");
    const content = "This is a test memory that will be associated with the message";
    const embedding = await generateEmbedding(content);
    console.log(`Generated embedding of length: ${embedding.length}`);
    
    // 4. Create a memory with the message ID
    console.log("\nCreating test memory with valid message_id...");
    const memory = await storage.createMemory({
      content,
      embedding,
      type: "prompt",
      messageId: message.id,
      metadata: { source: "test-script", timestamp: new Date().toISOString() }
    });
    console.log(`Successfully created memory with ID: ${memory.id}`);
    
    // 5. Verify memory can be retrieved
    console.log("\nVerifying memory retrieval by ID...");
    const retrievedMemory = await storage.getMemoryById(memory.id);
    console.log(`Retrieved memory: ${retrievedMemory ? "Success" : "Failed"}`);
    
    // 6. Test vector similarity search
    console.log("\nTesting vector similarity search...");
    const similarMemories = await storage.queryMemoriesByEmbedding(embedding, 5, 0.7);
    console.log(`Vector search found ${similarMemories.length} similar memories`);
    
    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
    return { message, memory, similarMemories };
  } catch (error) {
    console.error("Test failed with error:", error);
    throw error;
  }
}

// Run the test
testMemoryFunctionality().catch(error => {
  console.error("Test execution failed:", error);
  process.exit(1);
});