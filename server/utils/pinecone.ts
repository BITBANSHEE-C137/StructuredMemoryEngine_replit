import { Pinecone } from '@pinecone-database/pinecone';
import { Memory, memoryIdForUpsert } from '../../shared/schema';
import { log } from '../vite';

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
  namespace: string = 'default'
): Promise<{ 
  success: boolean; 
  upsertedCount: number;
  duplicateCount: number;
  dedupRate: number;
  totalProcessed: number;
}> {
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
    let newUpsertCount = 0;
    let dedupCount = 0;
    
    // Check for existing vectors to detect duplicates
    // We'll use the vector IDs to detect duplicates
    const generatedIds = memories.map(memory => memoryIdForUpsert(memory));
    
    try {
      // Fetch existing IDs (if any) - we'll use this for deduplication tracking
      const existingIds = new Set<string>();
      
      // Try to fetch vectors by ID to see which ones already exist
      // Use batching to handle large numbers of vectors
      const fetchBatchSize = 100;
      
      for (let i = 0; i < generatedIds.length; i += fetchBatchSize) {
        const idBatch = generatedIds.slice(i, i + fetchBatchSize);
        try {
          const existingVectors = await pineconeIndex.fetch(idBatch);
          
          // Add existing IDs to our tracking set
          Object.keys(existingVectors.vectors || {}).forEach(id => {
            existingIds.add(id);
          });
        } catch (e) {
          // If fetch fails (some versions of SDK behave differently), we'll just continue
          // and handle deduplication via upsert
          log(`Error fetching existing vectors for deduplication check: ${e}`, 'pinecone');
        }
      }
      
      // Now we know which vectors already exist
      dedupCount = existingIds.size;
      log(`Found ${dedupCount} duplicate vectors out of ${totalProcessed} total memories`, 'pinecone');
      
    } catch (e) {
      // If the above approach fails, we'll fall back to just tracking the count
      log(`Error checking for duplicates, will proceed with upsert: ${e}`, 'pinecone');
    }
    
    // Batch the upserts to avoid rate limits, using batches of 100
    const batchSize = 100;
    let successCount = 0;
    
    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      
      // Create records for upsert
      const records = batch.map(memory => {
        // Parse the embedding string into a float array
        const values = JSON.parse(memory.embedding);
        
        // Create a unique ID for the vector based on content
        // This is important for deduplication and updating
        const id = memoryIdForUpsert(memory);
        
        return {
          id,
          values,
          metadata: {
            id: memory.id,
            content: memory.content,
            type: memory.type,
            messageId: memory.messageId,
            timestamp: memory.timestamp,
            // Pinecone requires metadata values to be primitive types (string, number, boolean)
            // or arrays of strings. Convert complex objects to strings.
            relevant_ids: memory.metadata && typeof memory.metadata === 'object' && 
                           'relevantMemories' in memory.metadata && 
                           Array.isArray(memory.metadata.relevantMemories) ? 
              memory.metadata.relevantMemories.map((id: number) => id.toString()) : 
              [],
            memory_timestamp: memory.metadata && typeof memory.metadata === 'object' && 
                             'timestamp' in memory.metadata ? 
              String(memory.metadata.timestamp) : 
              new Date().toISOString(),
            // Add sync metadata to track the sync session
            sync_session: new Date().toISOString(),
            source_db: 'pgvector'
          }
        };
      });
      
      if (records.length > 0) {
        try {
          // Upsert records to Pinecone with namespace
          // Handle both old and new SDK versions
          try {
            // Method 1: Try with namespace parameter (older SDK)
            const upsertOptions = { namespace };
            await pineconeIndex.upsert(records, upsertOptions);
          } catch (e) {
            // Method 2: Try without namespace parameter (newer SDK)
            await pineconeIndex.upsert(records);
            log(`Upserted using new SDK method without namespace parameter`, 'pinecone');
          }
          
          successCount += records.length;
        } catch (err) {
          log(`Error during batch upsert: ${err}`, 'pinecone');
          throw err;
        }
      }
    }
    
    // Calculate deduplication rate as a percentage
    const dedupRate = totalProcessed > 0 ? (dedupCount / totalProcessed) * 100 : 0;
    
    // Actual newly inserted records (not counting overwrites of existing records)
    newUpsertCount = successCount - dedupCount;
    
    // The success count includes both new and overwritten records
    return {
      success: true,
      upsertedCount: newUpsertCount,
      duplicateCount: dedupCount,
      dedupRate: parseFloat(dedupRate.toFixed(2)),
      totalProcessed
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
  namespace: string = 'default'
): Promise<PineconeQueryResult[]> {
  try {
    const client = await getPineconeClient();
    const pineconeIndex = client.index(indexName);
    
    // Try both with and without namespace parameter to handle different SDK versions
    let queryResult;
    try {
      // Method 1: Try with namespace parameter (older SDK)
      queryResult = await pineconeIndex.query({
        vector: embedding,
        topK: limit,
        includeMetadata: true,
        namespace
      });
    } catch (e) {
      log(`Namespace parameter not supported, using new SDK method`, 'pinecone');
      // Method 2: Try without namespace parameter (newer SDK)
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
 * Directly fetch all vectors from a Pinecone index using a specialized approach
 * designed to get all vectors regardless of queryability
 */
export async function fetchAllVectorsFromIndex(
  indexName: string,
  namespace: string = 'default',
  limit: number = 1000
): Promise<any[]> {
  try {
    log(`Attempting to fetch all vectors from index ${indexName}, namespace ${namespace}`, 'pinecone');
    
    const pineconeClient = await getPineconeClient();
    const pineconeIndex = pineconeClient.Index(indexName);
    
    // Try multiple approaches to list all vectors
    
    // Create a special vector of all 0.1 that tends to match with everything
    const dimension = 1536; // Default for OpenAI embeddings
    const genericVector = Array(dimension).fill(0.1);
    
    // Try querying with a very high topK to get most vectors
    const response = await pineconeIndex.query({
      vector: genericVector,
      topK: limit,
      includeMetadata: true,
      includeValues: true
    });
    
    log(`Retrieved ${response.matches?.length || 0} vectors directly from index ${indexName}`, 'pinecone');
    
    // Return the matches
    return response.matches || [];
    
  } catch (error) {
    log(`Error fetching all vectors from index ${indexName}: ${error}`, 'pinecone');
    return [];
  }
}

/**
 * Fetch vectors from Pinecone to hydrate local pgvector database
 */
export async function fetchVectorsFromPinecone(
  indexName: string,
  namespace: string = 'default',
  limit: number = 1000
): Promise<PineconeVector[]> {
  try {
    log(`Fetching vectors from Pinecone index ${indexName}, namespace ${namespace}`, 'pinecone');
    const client = await getPineconeClient();
    const pineconeIndex = client.index(indexName);
    
    // Force fetch vectors even if stats say there are none
    // Try different methods to get vectors from index
    
    // First, we'll create several different random vectors to try to fetch data
    // from different regions of the vector space
    const dimension = 1536; // Use default OpenAI dimension
    log(`Using dimension ${dimension} for vector space search`, 'pinecone');
    
    // Create multiple random vectors to increase chances of finding matches
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
        // Try with namespace parameter (may fail on newer SDK)
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
          // Try without namespace (for newer SDK)
          const response = await pineconeIndex.query({
            vector: randomVectors[i],
            topK: limit,
            includeMetadata: true,
            includeValues: true
          });
          
          if (response.matches && response.matches.length > 0) {
            log(`Found ${response.matches.length} matches with vector approach #${i+1} (no namespace)`, 'pinecone');
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
        
        if (stats.totalRecordCount > 0) {
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
  dimension: number = 1536, // Default for OpenAI embeddings
  metric: string = 'cosine'
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
          region: 'us-east-1'  // Using us-east-1 instead of us-west-2 for free tier compatibility
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
 */
export async function wipePineconeIndex(
  indexName: string, 
  namespace: string = 'default'
): Promise<boolean> {
  try {
    const client = await getPineconeClient();
    const pineconeIndex = client.index(indexName);
    
    // Get index information to find the correct host
    let host = '';
    try {
      // First try to get the indexes list to find our index's host
      const indexes = await listPineconeIndexes();
      const index = indexes.find(idx => idx.name === indexName);
      if (index && index.host) {
        host = index.host;
        log(`Found host for index ${indexName}: ${host}`, 'pinecone');
      }
    } catch (hostError) {
      log(`Failed to retrieve host information: ${hostError}`, 'pinecone');
      // Continue with other methods
    }
    
    // In the latest Pinecone SDK, we need to use a different approach to delete all vectors
    // We'll try multiple methods to adapt to different Pinecone SDK versions
    let success = false;
    
    // Method 1: Using the direct delete API if we have the host
    if (host) {
      try {
        const protocol = host.startsWith('http') ? '' : 'https://';
        const response = await fetch(`${protocol}${host}/vectors/delete`, {
          method: 'POST',
          headers: {
            'Api-Key': process.env.PINECONE_API_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deleteAll: true,
            namespace
          }),
        });
        
        if (response.ok) {
          log(`Wiped all vectors from Pinecone index ${indexName} in namespace ${namespace} using direct API`, 'pinecone');
          success = true;
        } else {
          log(`Direct API call failed with status ${response.status}`, 'pinecone');
        }
      } catch (fetchError) {
        log(`Direct API call failed, falling back to SDK methods: ${fetchError}`, 'pinecone');
      }
    }
    
    // Method 2: Try using the standard SDK method if Method 1 failed
    if (!success) {
      try {
        // Cast to any to bypass TypeScript restrictions
        const indexAny = pineconeIndex as any;
        
        if (typeof indexAny.delete === 'function') {
          await indexAny.delete({ deleteAll: true, namespace });
          log(`Wiped all vectors using index.delete method`, 'pinecone');
          success = true;
        } else if (typeof indexAny._delete === 'function') {
          await indexAny._delete({ deleteAll: true, namespace });
          log(`Wiped all vectors using index._delete method`, 'pinecone');
          success = true;
        } else {
          log(`SDK delete methods not available, falling back to final approach`, 'pinecone');
        }
      } catch (sdkError) {
        log(`SDK delete methods failed: ${sdkError}`, 'pinecone');
      }
    }
    
    // Method 3: Use vector IDs as a last resort
    if (!success) {
      try {
        log(`Attempting to clear index using describeIndexStats`, 'pinecone');
        const stats = await pineconeIndex.describeIndexStats();
        // Use recordCount (newer SDK) or vectorCount (older SDK) property
        const count = stats.namespaces?.[namespace]?.recordCount || 
                      (stats.namespaces?.[namespace] as any)?.vectorCount || 0;
        
        if (count > 0) {
          log(`Found ${count} vectors to delete in namespace ${namespace}`, 'pinecone');
          try {
            // Try using namespace delete API (newer SDKs)
            const indexAny = pineconeIndex as any;
            if (typeof indexAny.deleteNamespace === 'function') {
              await indexAny.deleteNamespace(namespace);
              log(`Successfully deleted namespace ${namespace}`, 'pinecone');
              success = true;
            } else {
              throw new Error("deleteNamespace method not available");
            }
          } catch (nsError) {
            log(`Namespace deletion failed: ${nsError}`, 'pinecone');
            throw new Error("Could not wipe index using any available method");
          }
        } else {
          log(`No vectors found in namespace ${namespace}, nothing to delete`, 'pinecone');
          success = true; // Consider this a success if nothing to delete
        }
      } catch (statsError) {
        log(`Failed to get index stats: ${statsError}`, 'pinecone');
        throw new Error("Could not retrieve index statistics");
      }
    }
    
    return success;
  } catch (error) {
    log(`Error wiping Pinecone index: ${error}`, 'pinecone');
    throw error;
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