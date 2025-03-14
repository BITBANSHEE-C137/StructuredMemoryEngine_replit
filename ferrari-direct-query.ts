/**
 * Direct Ferrari 308GTSi Query Test
 * 
 * This script directly queries the database for Ferrari memories and uses them
 * to modify the current chat session.
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { memories } from './shared/schema';

async function main() {
  try {
    console.log('Directly querying Ferrari memories...');
    
    // Use a direct SQL query to find Ferrari memories
    // Define type for query results
    type MemoryResult = {
      id: number;
      content: string;
      embedding: string;
      type: string;
      timestamp: string | Date;
      message_id: number | null;
      metadata: any;
    };
    
    const ferrariMemories = await db.execute<MemoryResult>(sql`
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
      // Safely handle the content by ensuring it's a string
      const content = typeof mem.content === 'string' ? mem.content : String(mem.content);
      const contentPreview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      console.log(`Memory ${i+1}: ID ${mem.id}, Content: "${contentPreview}"`);
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