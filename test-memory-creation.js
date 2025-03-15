/**
 * Test script for memory and message creation
 * Tests the creation of messages and memories with proper foreign key constraints
 */

// Using ES modules as specified in package.json
import { db } from './server/db.js';
import { storage } from './server/storage.js';
import { generateEmbedding } from './server/utils/openai.js';

async function createTestData() {
  try {
    console.log('Creating test message...');
    const message = await storage.createMessage({
      content: 'This is a test message for memory storage',
      role: 'user',
      modelId: 'gpt-4o'
    });

    console.log(`Created message with ID: ${message.id}`);

    // Generate embedding for the test content
    console.log('Generating embedding for test memory...');
    const content = 'This is test memory content that will be stored with a valid message_id';
    const embedding = await generateEmbedding(content);
    
    console.log(`Generated embedding with length: ${embedding.length}`);

    // Create memory with the valid message ID
    console.log('Creating test memory with valid message_id...');
    const memory = await storage.createMemory({
      content: content,
      embedding: embedding,
      type: 'prompt',
      messageId: message.id,
      metadata: { source: 'test-script', timestamp: new Date().toISOString() }
    });

    console.log('Successfully created memory:');
    console.log(JSON.stringify(memory, null, 2));

    // Verify memory in database
    console.log('Verifying memory in database...');
    const verifyMemory = await storage.getMemoryById(memory.id);
    console.log('Retrieved memory:');
    console.log(JSON.stringify(verifyMemory, null, 2));

    // Test memory retrieval by embedding
    console.log('Testing memory retrieval by embedding...');
    const similarMemories = await storage.queryMemoriesByEmbedding(embedding, 5, 0.7);
    console.log(`Found ${similarMemories.length} similar memories:`);
    console.log(JSON.stringify(similarMemories, null, 2));

    return { message, memory, similarMemories };
  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('=== MEMORY CREATION TEST ===');
    const result = await createTestData();
    console.log('Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();