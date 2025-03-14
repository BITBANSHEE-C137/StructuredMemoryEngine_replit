import postgres from 'postgres';

// Database connection
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function main() {
  try {
    console.log("Creating a test memory with full-dimensional vector...");
    
    // Create a 1536-dimension vector filled with random values
    const embedding = JSON.stringify(Array(1536).fill(0).map(() => Math.random().toFixed(6)));
    
    // First check current count
    const result1 = await sql`SELECT COUNT(*) FROM memories`;
    console.log("Current memory count:", result1[0].count);
    
    // Insert a test memory with proper vector dimensions
    const result2 = await sql`
      INSERT INTO memories (content, embedding, type, timestamp, metadata)
      VALUES (
        'Direct Test Memory',
        ${embedding}::vector(1536),
        'prompt',
        NOW(),
        ${{source: 'direct-test', timestamp: new Date().toISOString()}}
      )
      RETURNING id
    `;
    
    console.log("Inserted memory with ID:", result2[0].id);
    
    // Verify final count
    const result3 = await sql`SELECT COUNT(*) FROM memories`;
    console.log("Final memory count:", result3[0].count);
    
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();