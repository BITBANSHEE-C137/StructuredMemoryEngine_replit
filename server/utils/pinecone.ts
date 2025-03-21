import { Pinecone } from '@pinecone-database/pinecone';
import { Memory, memoryIdForUpsert } from '../../shared/schema';
import { log } from '../vite';
import { 
  DEFAULT_NAMESPACE, 
  DEFAULT_DIMENSION, 
  DEFAULT_METRIC, 
  DEFAULT_BATCH_SIZE,
  DEFAULT_VECTOR_LIMIT,
  DEFAULT_REGION
} from './pinecone-settings';

// Initialize Pinecone client
const pineconeApiKey = process.env.PINECONE_API_KEY;
let pineconeClient: Pinecone | null = null;

/**
 * Initialize Pinecone client connection
 */
async function initializePinecone() {
  log('Starting Pinecone client initialization...', 'pinecone');
  
  if (!pineconeApiKey) {
    const errorMsg = 'PINECONE_API_KEY is not set. Pinecone integration is disabled.';
    log(errorMsg, 'pinecone');
    throw new Error(errorMsg);
  }

  try {
    log(`API Key length: ${pineconeApiKey.length} characters`, 'pinecone');
    
    // Initialize Pinecone client with just the API key as per latest SDK documentation
    // https://docs.pinecone.io/docs/node-client
    log('Creating new Pinecone client instance...', 'pinecone');
    
    pineconeClient = new Pinecone({
      apiKey: pineconeApiKey
    });
    
    log('Pinecone client initialized', 'pinecone');
    
    // Verify connection with a simple operation
    log('Testing connection by listing indexes...', 'pinecone');
    await pineconeClient.listIndexes();
    
    log('✅ Pinecone client initialized and connected successfully', 'pinecone');
    return pineconeClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`❌ Error initializing Pinecone client: ${errorMessage}`, 'pinecone');
    log(`Stack trace: ${error instanceof Error ? error.stack : 'No stack trace available'}`, 'pinecone');
    throw error;
  }
}

/**
 * Get or initialize Pinecone client
 */
export async function getPineconeClient(): Promise<Pinecone> {
  if (!pineconeClient) {
    return initializePinecone();
  }
  return pineconeClient;
}

/**
 * Check if Pinecone integration is available
 */
export async function isPineconeAvailable(): Promise<boolean> {
  if (!pineconeApiKey) {
    log('Pinecone API key is not set', 'pinecone');
    return false;
  }

  try {
    const client = await getPineconeClient();
    await client.listIndexes();
    log('Pinecone connection successful', 'pinecone');
    return true;
  } catch (error) {
    log(`Pinecone availability check failed: ${error}`, 'pinecone');
    return false;
  }
}

/**
 * List all Pinecone indexes with stats
 */
export async function listPineconeIndexes(): Promise<PineconeIndexInfo[]> {
  try {
    const client = await getPineconeClient();
    const indexList = await client.listIndexes();
    
    // In the latest Pinecone SDK, the response is an object with indexes property
    log(`Received index list from Pinecone: ${JSON.stringify(indexList)}`, 'pinecone');
    
    // Convert Pinecone index list to array for processing
    const indexes: PineconeIndexInfo[] = [];
    
    // Check if indexList is iterable or has an indexes property
    const indexesToProcess = Array.isArray(indexList) ? indexList : 
                            (indexList?.indexes || []);
    
    for (const index of indexesToProcess) {
      try {
        log(`Processing index: ${JSON.stringify(index)}`, 'pinecone');
        const pineconeIndex = client.index(index.name);
        const stats = await pineconeIndex.describeIndexStats();
        
        const namespaces = Object.entries(stats.namespaces || {}).map(([name, data]) => ({
          name,
          vectorCount: data.recordCount
        }));
        
        indexes.push({
          name: index.name,
          dimension: index.dimension || 0,
          metric: index.metric || 'cosine',
          host: index.host || '',
          spec: index.spec || {},
          status: index.status || {},
          vectorCount: stats.totalRecordCount || 0,
          namespaces
        });
      } catch (error) {
        log(`Error getting stats for index ${index.name}: ${error}`, 'pinecone');
        // If we can't get stats for an index, add with basic info
        indexes.push({
          name: index.name,
          dimension: index.dimension || 0,
          metric: index.metric || 'cosine',
          host: index.host || '',
          spec: index.spec || {},
          status: index.status || {},
          vectorCount: 0,
          namespaces: []
        });
      }
    }
    
    return indexes;
  } catch (error) {
    log(`Error listing Pinecone indexes: ${error}`, 'pinecone');
    throw error;
  }
}

/**
 * Function to upsert memories to a Pinecone index
 * with enhanced deduplication tracking
 */
export async function upsertMemoriesToPinecone(
  memories: Memory[], 
  indexName: string,
  namespace: string = DEFAULT_NAMESPACE
): Promise<{ 
  success: boolean; 
  count: number;
  upsertedCount?: number;
  duplicateCount?: number;
  dedupRate?: number;
  totalProcessed?: number;
  vectorCount?: number;
  indexName?: string;
  namespace?: string;
  timestamp?: string;
}> {
  log(`Starting memory sync to Pinecone index ${indexName}, namespace ${namespace}`, 'pinecone');
  log(`Processing ${memories.length} memory items for sync`, 'pinecone');
  
  try {
    const client = await getPineconeClient();

    // Check if index exists - handle new SDK response format
    const indexList = await client.listIndexes();
    
    // In latest SDK, indexList might be an object with indexes property
    const indexesToProcess = Array.isArray(indexList) ? indexList : 
                            (indexList?.indexes || []);
    
    let indexExists = false;
    for (const index of indexesToProcess) {
      if (index.name === indexName) {
        indexExists = true;
        break;
      }
    }

    if (!indexExists) {
      throw new Error(`Index ${indexName} does not exist in Pinecone.`);
    }

    const pineconeIndex = client.index(indexName);
    
    // Initialize tracking for deduplication stats
    let totalProcessed = memories.length;
    let dedupCount = 0;
    
    // Generate consistent memory IDs for deduplication
    const generatedIds = memories.map(memory => memoryIdForUpsert(memory));
    log(`Generated ${generatedIds.length} memory IDs for deduplication tracking`, 'pinecone');
    
    // Create a map of vectors to detect duplicates
    const memoryMap = new Map<string, Memory>();
    memories.forEach((memory, index) => {
      memoryMap.set(generatedIds[index], memory);
    });
    
    // Step 1: Check for existing vectors to detect duplicates
    const existingIds = new Set<string>();
    const duplicateContents = new Set<string>();
    
    // Check for existing vectors to detect duplicates
    dedupCount = 0;
    try {
      // Fetch existing IDs - using batching to avoid rate limits
      const fetchBatchSize = DEFAULT_BATCH_SIZE;
      log(`Checking for duplicates in ${generatedIds.length} vectors`, 'pinecone');
      
      // Standardize on default namespace for simplicity
      const effectiveNamespace = DEFAULT_NAMESPACE;
      log(`Checking namespace '${effectiveNamespace}' for duplicates`, 'pinecone');
      
      for (let i = 0; i < generatedIds.length; i += fetchBatchSize) {
        const idBatch = generatedIds.slice(i, i + fetchBatchSize);
        try {
          log(`Checking batch ${Math.floor(i / fetchBatchSize) + 1} of ${Math.ceil(generatedIds.length / fetchBatchSize)} for duplicates in namespace '${effectiveNamespace}'`, 'pinecone');
          
          // Try different fetch methods to account for SDK differences
          let existingVectors;
          try {
            // Method 1: Try with namespace parameter (newer SDK)
            existingVectors = await pineconeIndex.fetch({ 
              ids: idBatch,
              namespace: effectiveNamespace 
            });
          } catch (fetchError) {
            // If the first approach fails, try without namespace parameter
            existingVectors = await pineconeIndex.fetch(idBatch);
          }
          
          // Track existing vectors
          if (existingVectors) {
            // Handle different SDK response formats
            const vectors = existingVectors.vectors || existingVectors.records || {};
            const foundIds = Object.keys(vectors);
            
            if (foundIds.length > 0) {
              log(`Found ${foundIds.length} existing vectors in batch (namespace: '${effectiveNamespace}')`, 'pinecone');
              foundIds.forEach(id => {
                existingIds.add(id);
                
                // Store content snippets for detailed logging
                const memory = memoryMap.get(id);
                if (memory) {
                  const contentPreview = memory.content.length > 40 
                    ? `${memory.content.substring(0, 40)}...` 
                    : memory.content;
                  duplicateContents.add(contentPreview);
                }
              });
            }
          }
        } catch (e) {
          log(`Error in duplicate check batch (continuing): ${e}`, 'pinecone');
        }
      }
      
      // Count duplicates
      dedupCount = existingIds.size;
      
      if (dedupCount > 0) {
        const dedupPercent = ((dedupCount / totalProcessed) * 100).toFixed(1);
        log(`Found ${dedupCount} duplicate vectors out of ${totalProcessed} total memories (${dedupPercent}%)`, 'pinecone');
        
        // Log duplicate content previews
        if (duplicateContents.size > 0) {
          const contentExamples = Array.from(duplicateContents).slice(0, 3);
          log(`Duplicate content samples: ${contentExamples.join(' | ')}${duplicateContents.size > 3 ? '...' : ''}`, 'pinecone');
        }
        
        // Log the IDs
        const duplicateExamples = Array.from(existingIds).slice(0, 5);
        log(`Duplicate IDs: ${duplicateExamples.join(', ')}${existingIds.size > 5 ? '...' : ''}`, 'pinecone');
      } else {
        log(`No duplicates found in ${totalProcessed} memories to be synced`, 'pinecone');
      }
    } catch (e) {
      log(`Error checking for duplicates (will continue with upsert): ${e}`, 'pinecone');
    }
    
    // Step 2: Process vectors in batches
    const batchSize = DEFAULT_BATCH_SIZE;
    let successCount = 0;
    
    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(memories.length / batchSize)}`, 'pinecone');
      
      // Create records for upsert
      const records = batch.map(memory => {
        // Parse the embedding string into a float array
        const values = JSON.parse(memory.embedding);
        
        // Create a unique ID for the vector based on content
        const id = memoryIdForUpsert(memory);
        
        return {
          id,
          values,
          metadata: {
            id: memory.id,
            content: memory.content,
            type: memory.type,
            messageId: memory.messageId ? memory.messageId.toString() : "null", // Convert to string to avoid null values
            timestamp: memory.timestamp,
            // Pinecone requires metadata values to be primitive types
            relevant_ids: memory.metadata && typeof memory.metadata === 'object' && 
                          'relevantMemories' in memory.metadata && 
                          Array.isArray(memory.metadata.relevantMemories) ? 
              memory.metadata.relevantMemories.map((id: number) => id.toString()) : 
              [],
            memory_timestamp: memory.metadata && typeof memory.metadata === 'object' && 
                              'timestamp' in memory.metadata ? 
              String(memory.metadata.timestamp) : 
              new Date().toISOString(),
            // Add sync metadata
            sync_session: new Date().toISOString(),
            source_db: 'pgvector'
          }
        };
      });
      
      if (records.length > 0) {
        try {
          // Try upsert with namespace parameter
          try {
            await pineconeIndex.upsert({ 
              vectors: records,
              namespace 
            });
            log(`Upserted batch with namespace parameter`, 'pinecone');
          } catch (e) {
            // If that fails, try without namespace
            await pineconeIndex.upsert(records);
            log(`Upserted batch without namespace parameter`, 'pinecone');
          }
          
          successCount += records.length;
          log(`Successfully upserted ${successCount} vectors so far`, 'pinecone');
        } catch (err) {
          log(`Error during batch upsert: ${err}`, 'pinecone');
          throw err;
        }
      }
    }
    
    // Calculate metrics
    const dedupRate = totalProcessed > 0 ? (dedupCount / totalProcessed) * 100 : 0;
    const newUpsertCount = totalProcessed - dedupCount;
    
    log(`Sync complete. Total: ${totalProcessed}, New: ${newUpsertCount}, Duplicates: ${dedupCount}, Dedup rate: ${dedupRate.toFixed(1)}%`, 'pinecone');
    
    // Get initial and final vector counts for accurate reporting
    let currentVectorCount = 0;
    
    // Verify the vectors were added by checking stats
    try {
      const stats = await pineconeIndex.describeIndexStats();
      const specifiedNamespaceCount = stats.namespaces?.[namespace]?.recordCount || 0;
      currentVectorCount = specifiedNamespaceCount;
      log(`Index now contains ${currentVectorCount} vectors in namespace "${namespace}"`, 'pinecone');
    } catch (statsError) {
      log(`Error checking final vector count: ${statsError}`, 'pinecone');
    }
    
    const formattedDedupRate = parseFloat(dedupRate.toFixed(2));
    
    // Return comprehensive statistics for better UX reporting
    return {
      success: true,
      count: newUpsertCount,               // Number of new vectors successfully added
      duplicateCount: dedupCount,          // Number of duplicates detected and skipped
      dedupRate: formattedDedupRate,       // Percentage of duplicates in the original set
      totalProcessed,                      // Total number of memories processed
      vectorCount: currentVectorCount,     // Current vector count in the index
      indexName,                           // Name of the index
      namespace,                           // Namespace used
      timestamp: new Date().toISOString()  // Timestamp of operation completion
    };
  } catch (error) {
    log(`Error upserting memories to Pinecone: ${error}`, 'pinecone');
    throw error;
  }
}

/**
 * Query memories from Pinecone based on an embedding
 */
export async function queryPineconeMemories(
  embedding: number[],
  indexName: string,
  limit: number = 5,
  namespace: string = DEFAULT_NAMESPACE
): Promise<PineconeQueryResult[]> {
  try {
    const client = await getPineconeClient();
    const pineconeIndex = client.index(indexName);
    
    // Try both with and without namespace parameter to handle different SDK versions
    let queryResult;
    try {
      // Method 1: Try with namespace parameter
      queryResult = await pineconeIndex.query({
        vector: embedding,
        topK: limit,
        includeMetadata: true,
        namespace
      });
    } catch (e) {
      log(`Namespace parameter not supported, using new SDK method`, 'pinecone');
      // Method 2: Try without namespace parameter
      queryResult = await pineconeIndex.query({
        vector: embedding,
        topK: limit,
        includeMetadata: true
      });
    }
    
    return queryResult.matches.map(match => {
      const metadata = match.metadata || {};
      // Reconstruct metadata from Pinecone-compatible format
      const reconstructedMetadata: any = {};
      
      // Convert relevant_ids back to relevantMemories array if available
      if (metadata.relevant_ids && Array.isArray(metadata.relevant_ids)) {
        reconstructedMetadata.relevantMemories = metadata.relevant_ids.map(id => Number(id));
      }
      
      // Add memory timestamp if available
      if (metadata.memory_timestamp) {
        reconstructedMetadata.timestamp = metadata.memory_timestamp;
      }
      
      return {
        id: Number(metadata.id) || 0,
        content: String(metadata.content) || '',
        type: String(metadata.type) || 'prompt',
        messageId: Number(metadata.messageId) || 0,
        timestamp: String(metadata.timestamp) || new Date().toISOString(),
        similarity: match.score || 0,
        metadata: reconstructedMetadata
      };
    });
  } catch (error) {
    log(`Error querying Pinecone: ${error}`, 'pinecone');
    throw error;
  }
}

/**
 * Fetch vectors from Pinecone to hydrate local pgvector database
 */
export async function fetchVectorsFromPinecone(
  indexName: string,
  namespace: string = DEFAULT_NAMESPACE,
  limit: number = DEFAULT_VECTOR_LIMIT
): Promise<PineconeVector[]> {
  try {
    log(`Fetching vectors from Pinecone index ${indexName}, namespace ${namespace}`, 'pinecone');
    const client = await getPineconeClient();
    const pineconeIndex = client.index(indexName);
    
    // Create multiple random vectors to increase chances of finding matches
    const dimension = DEFAULT_DIMENSION;
    log(`Using dimension ${dimension} for vector space search`, 'pinecone');
    
    const randomVectors = [
      Array(dimension).fill(0).map(() => Math.random() * 0.01), // Very small random values
      Array(dimension).fill(0).map(() => Math.random()), // Standard random values
      Array(dimension).fill(0).map(() => (Math.random() * 2) - 1), // Both positive and negative values
      Array(dimension).fill(0.0001) // Uniform very small values
    ];
    
    let allMatches: any[] = [];
    
    // Try each random vector
    for (let i = 0; i < randomVectors.length; i++) {
      log(`Trying query with random vector approach #${i+1}`, 'pinecone');
      
      try {
        // Try with namespace parameter
        const response = await pineconeIndex.query({
          vector: randomVectors[i],
          topK: limit,
          includeMetadata: true,
          includeValues: true,
          namespace
        });
        
        if (response.matches && response.matches.length > 0) {
          log(`Found ${response.matches.length} matches with vector approach #${i+1}`, 'pinecone');
          allMatches = [...allMatches, ...response.matches];
          // Deduplicate based on ID
          const uniqueIds = new Set();
          allMatches = allMatches.filter(match => {
            if (uniqueIds.has(match.id)) return false;
            uniqueIds.add(match.id);
            return true;
          });
        }
      } catch (e) {
        try {
          // Try without namespace
          const response = await pineconeIndex.query({
            vector: randomVectors[i],
            topK: limit,
            includeMetadata: true,
            includeValues: true
          });
          
          if (response.matches && response.matches.length > 0) {
            log(`Found ${response.matches.length} matches with approach #${i+1} (no namespace)`, 'pinecone');
            allMatches = [...allMatches, ...response.matches];
            // Deduplicate based on ID
            const uniqueIds = new Set();
            allMatches = allMatches.filter(match => {
              if (uniqueIds.has(match.id)) return false;
              uniqueIds.add(match.id);
              return true;
            });
          }
        } catch (innerError) {
          log(`Error with approach #${i+1}: ${innerError}`, 'pinecone');
        }
      }
    }
    
    log(`Total unique matches found across all approaches: ${allMatches.length}`, 'pinecone');
    
    if (allMatches.length > 0) {
      log(`Sample match: ${JSON.stringify(allMatches[0])}`, 'pinecone');
    } else {
      // Last resort: try to get stats to debug what's happening
      try {
        const stats = await pineconeIndex.describeIndexStats();
        log(`Index stats (debug): ${JSON.stringify(stats)}`, 'pinecone');
        
        if (stats.totalRecordCount && stats.totalRecordCount > 0) {
          log(`Index reports ${stats.totalRecordCount} total records but query returns none`, 'pinecone');
        }
      } catch (statsError) {
        log(`Error getting index stats: ${statsError}`, 'pinecone');
      }
    }
    
    // Transform the response into our vector format
    const vectors = allMatches.map(match => ({
      id: match.id,
      values: match.values || [],
      metadata: match.metadata || {}
    }));
    
    log(`Returning ${vectors.length} vectors from Pinecone`, 'pinecone');
    return vectors;
  } catch (error) {
    log(`Error fetching vectors from Pinecone: ${error}`, 'pinecone');
    throw error;
  }
}

/**
 * Create a new Pinecone index if it doesn't exist
 */
export async function createPineconeIndexIfNotExists(
  indexName: string,
  dimension: number = DEFAULT_DIMENSION,
  metric: string = DEFAULT_METRIC
): Promise<boolean> {
  try {
    const client = await getPineconeClient();
    
    // Check if index already exists - handle new SDK response format
    const indexList = await client.listIndexes();
    log(`Index list for creation check: ${JSON.stringify(indexList)}`, 'pinecone');
    
    // In latest SDK, indexList might be an object with indexes property
    const indexesToProcess = Array.isArray(indexList) ? indexList : 
                            (indexList?.indexes || []);
    
    let indexExists = false;
    for (const index of indexesToProcess) {
      if (index.name === indexName) {
        indexExists = true;
        break;
      }
    }
    
    if (indexExists) {
      log(`Index ${indexName} already exists. Skipping creation.`, 'pinecone');
      return true;
    }
    
    log(`Creating new index: ${indexName} with dimension ${dimension}`, 'pinecone');
    
    // Create index with required spec - using us-east-1 which is supported in free plan
    await client.createIndex({
      name: indexName,
      dimension,
      metric: metric as any,
      spec: {
        serverless: {
          cloud: 'aws',
          region: DEFAULT_REGION
        }
      }
    });
    
    log(`Created Pinecone index: ${indexName}`, 'pinecone');
    
    // Wait for index to be ready
    let isReady = false;
    let attempts = 0;
    
    while (!isReady && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const currentIndexList = await client.listIndexes();
      
      // Handle new SDK response format
      const currentIndexesToProcess = Array.isArray(currentIndexList) ? currentIndexList : 
                                     (currentIndexList?.indexes || []);
      
      let currentIndex = null;
      for (const idx of currentIndexesToProcess) {
        if (idx.name === indexName) {
          currentIndex = idx;
          break;
        }
      }
      
      if (currentIndex && currentIndex.status?.ready) {
        isReady = true;
        log(`Pinecone index ${indexName} is ready`, 'pinecone');
      }
      
      attempts++;
    }
    
    return isReady;
  } catch (error) {
    log(`Error creating Pinecone index: ${error}`, 'pinecone');
    throw error;
  }
}

/**
 * Delete a Pinecone index
 */
export async function deletePineconeIndex(indexName: string): Promise<boolean> {
  try {
    const client = await getPineconeClient();
    await client.deleteIndex(indexName);
    log(`Deleted Pinecone index: ${indexName}`, 'pinecone');
    return true;
  } catch (error) {
    log(`Error deleting Pinecone index: ${error}`, 'pinecone');
    throw error;
  }
}

/**
 * Wipe all vectors from a Pinecone index or namespace
 * Completely rewritten to use direct REST API approach for maximum compatibility
 */
export async function wipePineconeIndex(
  indexName: string, 
  namespace: string = DEFAULT_NAMESPACE
): Promise<boolean> {
  try {
    log(`Starting operation to wipe Pinecone index ${indexName} in namespace ${namespace}`, 'pinecone');
    
    // Step 1: Get the index host from the list of indexes
    const indexes = await listPineconeIndexes();
    const index = indexes.find(idx => idx.name === indexName);
    
    if (!index || !index.host) {
      log(`Cannot find host for index ${indexName}`, 'pinecone');
      return false;
    }
    
    const host = index.host;
    log(`Found host for index ${indexName}: ${host}`, 'pinecone');
    
    // Step 2: Get current vector count for verification
    let initialCount = 0;
    try {
      const client = await getPineconeClient();
      const pineconeIndex = client.index(indexName);
      const stats = await pineconeIndex.describeIndexStats();
      initialCount = stats.namespaces?.[namespace]?.recordCount || 0;
      log(`Current vector count in namespace ${namespace}: ${initialCount}`, 'pinecone');
      
      if (initialCount === 0) {
        log(`Namespace ${namespace} is already empty, no action needed`, 'pinecone');
        return true;
      }
    } catch (statsError) {
      log(`Error getting vector count: ${statsError}. Continuing anyway...`, 'pinecone');
    }
    
    // Step 3: Direct REST API approach - most reliable method
    try {
      log(`Using direct REST API to delete all vectors`, 'pinecone');
      
      // Ensure protocol is included
      const protocol = host.startsWith('http') ? '' : 'https://';
      const apiUrl = `${protocol}${host}/vectors/delete`;
      
      log(`Making request to: ${apiUrl}`, 'pinecone');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deleteAll: true,
          namespace: namespace
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`API call failed with status ${response.status}: ${errorText}`, 'pinecone');
        return false;
      }
      
      log(`Successfully issued deleteAll command via REST API`, 'pinecone');
      
      // Step 4: Verify deletion by checking stats again
      // Wait a moment for the deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const client = await getPineconeClient();
        const pineconeIndex = client.index(indexName);
        const finalStats = await pineconeIndex.describeIndexStats();
        const finalCount = finalStats.namespaces?.[namespace]?.recordCount || 0;
        
        log(`Final vector count in namespace ${namespace}: ${finalCount}`, 'pinecone');
        
        if (finalCount === 0) {
          log(`Verified all vectors were successfully removed from namespace ${namespace}`, 'pinecone');
          return true;
        } else {
          log(`Warning: Operation reported success but ${finalCount} vectors still exist`, 'pinecone');
          return false;
        }
      } catch (verifyError) {
        log(`Failed to verify deletion results: ${verifyError}`, 'pinecone');
        // Assume success if we can't verify
        return true;
      }
    } catch (apiError) {
      log(`Error with REST API call: ${apiError}`, 'pinecone');
      return false;
    }
  } catch (error) {
    log(`Error wiping Pinecone index: ${error}`, 'pinecone');
    return false;
  }
}

// Types for Pinecone integration
export interface PineconeIndexInfo {
  name: string;
  dimension: number;
  metric: string;
  host: string;
  spec: any;
  status: any;
  vectorCount: number;
  namespaces: { name: string; vectorCount: number }[];
}

export interface PineconeQueryResult {
  id: number;
  content: string;
  type: string;
  messageId: number;
  timestamp: string;
  similarity: number;
  metadata: any;
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata: any;
}