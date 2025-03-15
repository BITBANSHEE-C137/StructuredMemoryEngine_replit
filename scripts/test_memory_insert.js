/**
 * Test script for direct memory insertion
 * This script inserts a test memory directly into the database
 */
import { db } from '../server/db.ts';
import { sql } from 'drizzle-orm';

async function createTestMemory() {
  try {
    console.log('Creating test memory...');
    
    // Generate a 1536-dimension vector with random values
    const embedding = Array(1536).fill(0).map(() => Math.random());
    
    // Insert directly using raw SQL to ensure proper vector type handling
    const result = await db.execute(sql`
      INSERT INTO memories (content, embedding, type, message_id, metadata)
      VALUES (
        'Test Memory Content',
        ${JSON.stringify(embedding)}::vector,
        'prompt',
        2058,
        ${'{"source": "test", "test": true}'}::jsonb
      )
      RETURNING *
    `);
    
    console.log('Memory created with ID:', result[0].id);
    
    // Verify the count
    const [{ count }] = await db.select({ count: sql`count(*)` }).from(sql`memories`);
    console.log('Total memories in database:', count);
    
    return result[0];
  } catch (error) {
    console.error('Error creating test memory:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('=== MEMORY INSERT TEST ===');
    
    // Insert the test memory
    const memory = await createTestMemory();
    console.log('Memory details:', memory);
    
    console.log('=== TEST COMPLETE ===');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main();