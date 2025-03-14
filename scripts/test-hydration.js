/**
 * Test script for hydration process
 * This script directly tests the hydration from Pinecone to pg database
 */
import fetch from 'node-fetch';

async function fetchPineconeStats() {
  try {
    console.log('Fetching Pinecone stats...');
    const response = await fetch('http://localhost:5000/api/pinecone/stats');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const stats = await response.json();
    console.log('Pinecone stats:', stats);
    return stats;
  } catch (error) {
    console.error('Error fetching Pinecone stats:', error);
    throw error;
  }
}

async function getMemoriesCount() {
  try {
    console.log('Fetching memories count from pgvector...');
    const response = await fetch('http://localhost:5000/api/memories?page=1&pageSize=1');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Memories result:', result);
    return result.total;
  } catch (error) {
    console.error('Error fetching memories count:', error);
    throw error;
  }
}

async function performHydration(indexName, namespace = 'default', limit = 1000) {
  try {
    console.log(`Performing hydration from Pinecone index ${indexName}, namespace ${namespace}, limit ${limit}...`);
    
    const response = await fetch('http://localhost:5000/api/pinecone/hydrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        indexName,
        namespace,
        limit,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Hydration result:', result);
    return result;
  } catch (error) {
    console.error('Error performing hydration:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('=== HYDRATION TEST SCRIPT ===');
    
    // Step 1: Get current Pinecone stats
    const pineconeStats = await fetchPineconeStats();
    
    if (!pineconeStats.activeIndex) {
      console.error('No active Pinecone index found');
      return;
    }
    
    // Step 2: Get current memories count
    const initialMemoriesCount = await getMemoriesCount();
    console.log(`Initial memories count: ${initialMemoriesCount}`);
    
    // Step 3: Perform hydration
    const hydrationResult = await performHydration(
      pineconeStats.activeIndex,
      'default', // namespace
      1000 // limit
    );
    
    // Step 4: Get updated memories count
    const finalMemoriesCount = await getMemoriesCount();
    console.log(`Final memories count: ${finalMemoriesCount}`);
    
    // Step 5: Verify results
    console.log('=== HYDRATION TEST RESULTS ===');
    console.log(`Pinecone vectors: ${pineconeStats.vectorCount}`);
    console.log(`Initial memories count: ${initialMemoriesCount}`);
    console.log(`Vectors processed during hydration: ${hydrationResult.totalProcessed || 0}`);
    console.log(`Memories created during hydration: ${hydrationResult.count || 0}`);
    console.log(`Final memories count: ${finalMemoriesCount}`);
    console.log(`Duplicates detected: ${hydrationResult.duplicateCount || 0}`);
    console.log(`Deduplication rate: ${hydrationResult.dedupRate?.toFixed(2) || 0}%`);
    
    // Check for discrepancies
    if (finalMemoriesCount !== hydrationResult.count + initialMemoriesCount) {
      console.warn('WARNING: Discrepancy detected between hydration result count and actual memories increase');
      console.warn(`Expected final count: ${hydrationResult.count + initialMemoriesCount}, Actual: ${finalMemoriesCount}`);
    }
    
    console.log('=== TEST COMPLETE ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});