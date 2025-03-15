/**
 * Ferrari 308GTSi Test Data Creator
 * 
 * This script inserts a test memory about a Ferrari 308GTSi into the database
 * with a proper embedding to test the retrieval system.
 */

import { db } from './server/db';
import { memories } from './shared/schema';
import * as openai from './server/utils/openai';

async function main() {
  try {
    console.log('Creating Ferrari test data...');
    
    // Test content about Ferrari
    const ferrariContent = "My favorite car is the Ferrari 308GTSi. It's a beautiful classic car with amazing styling.";
    
    // Generate a proper embedding
    console.log('Generating embedding...');
    const embedding = await openai.generateEmbedding(ferrariContent);
    
    // Insert the memory with proper embedding
    console.log('Inserting memory...');
    const result = await db.insert(memories).values({
      content: ferrariContent,
      embedding: embedding,
      type: 'prompt',
      timestamp: new Date(),
      messageId: null,
      metadata: {}
    }).returning();
    
    console.log('Success! Added Ferrari memory:', result);
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

main()
  .then(() => console.log('Done'))
  .catch(err => console.error('Script failed:', err));