import postgres from 'postgres';

// Database connection
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function main() {
  try {
    console.log("Testing vector insertion...");
    
    // Create a vector with exactly 1536 dimensions as required by the schema
    const vector = Array(1536).fill(0).map(() => Math.random());
    
    // First check current count
    const result1 = await sql`SELECT COUNT(*) FROM memories`;
    console.log("Current memory count:", result1[0].count);
    
    // Try raw SQL approach
    const insertQuery = `
      INSERT INTO memories (content, embedding, type, timestamp, metadata)
      VALUES (
        'Vector Test Memory',
        '[${vector.join(',')}]',
        'prompt',
        NOW(),
        '{"source": "test-vector-insert", "timestamp": "${new Date().toISOString()}"}'
      )
      RETURNING id;
    `;
    
    console.log("Executing SQL query...");
    const result2 = await sql.unsafe(insertQuery);
    
    console.log("Inserted memory with ID:", result2[0].id);
    
    // Verify final count
    const result3 = await sql`SELECT COUNT(*) FROM memories`;
    console.log("Final memory count:", result3[0].count);
    
    // Check the record
    const result4 = await sql`SELECT id, content, type FROM memories ORDER BY id DESC LIMIT 1`;
    console.log("Inserted record:", result4[0]);
    
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

main();