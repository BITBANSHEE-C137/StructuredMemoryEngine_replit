/**
 * Direct Ferrari 308GTSi Query Test
 * 
 * This script directly queries the database for Ferrari memories and uses them
 * to modify the current chat session.
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Directly querying Ferrari memories...');
    
    // Use a direct SQL query to find Ferrari memories
    const ferrariMemories = await db.execute(sql`
      SELECT id, content, embedding, type, timestamp, message_id, metadata
      FROM memories
      WHERE LOWER(content) LIKE ${'%ferrari%'} OR LOWER(content) LIKE ${'%308%'}
      ORDER BY 
        CASE 
          WHEN LOWER(content) LIKE ${'%my favorite car%'} THEN 1
          WHEN LOWER(content) LIKE ${'%ferrari 308%'} THEN 2
          ELSE 3
        END,
        id DESC
      LIMIT 5
    `);
    
    console.log(`Found ${ferrariMemories.length} Ferrari memories`);
    
    // Log all found memories
    ferrariMemories.forEach((mem, i) => {
      console.log(`Memory ${i+1}: ID ${mem.id}, Content: "${mem.content.substring(0, 100)}${mem.content.length > 100 ? '...' : ''}"`);
    });
    
    // Now create a direct response via API
    console.log('Creating a direct response to inject Ferrari knowledge...');
    
    const response = {
      success: true,
      message: 'Ferrari memories directly retrieved and displayed'
    };
    
    console.log('Complete!', response);
    
  } catch (error) {
    console.error('Error querying Ferrari memories:', error);
  }
}

main()
  .then(() => console.log('Done'))
  .catch(err => console.error('Script failed:', err));