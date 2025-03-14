import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function createTestMemory() {
  try {
    console.log('Creating test memory...');
    
    // Generate a small test vector (3 dimensions for simplicity)
    const embedding = Array(1536).fill(0).map(() => Math.random());
    
    // Insert directly using raw SQL to ensure proper vector type handling
    const result = await db.execute(sql`
      INSERT INTO memories (content, embedding, type, message_id, metadata)
      VALUES (
        'Test Memory Content',
        ${JSON.stringify(embedding)}::vector,
        'prompt',
        null,
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
    console.log('== Memory Test Script ==');
    
    // First check the current count
    const [{ count: initialCount }] = await db.select({ count: sql`count(*)` }).from(sql`memories`);
    console.log('Initial memory count:', initialCount);
    
    // Create a test memory
    const memory = await createTestMemory();
    console.log('Test memory created successfully:', memory.id);
    
    // Get memory by ID to verify it exists
    const [fetchedMemory] = await db.execute(
      sql`SELECT * FROM memories WHERE id = ${memory.id}`
    );
    console.log('Retrieved memory by ID:', fetchedMemory.id);
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    // Important to close the connection when done
    process.exit(0);
  }
}

main();