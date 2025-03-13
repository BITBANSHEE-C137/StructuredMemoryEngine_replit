import { Pinecone } from '@pinecone-database/pinecone';
import { Memory, memoryIdForUpsert } from '../../shared/schema';
import { log } from '../vite';

// Initialize Pinecone client
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeEnvironment = process.env.PINECONE_ENVIRONMENT;
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
  
  if (!pineconeEnvironment) {
    const errorMsg = 'PINECONE_ENVIRONMENT is not set. Pinecone integration is disabled.';
    log(errorMsg, 'pinecone');
    throw new Error(errorMsg);
  }

  try {
    log(`Initializing Pinecone client with environment: ${pineconeEnvironment}`, 'pinecone');
    log(`API Key length: ${pineconeApiKey.length} characters`, 'pinecone');
    
    // Check for newer SDK version compatibility
    log('Creating new Pinecone client instance...', 'pinecone');
    
    // The newer Pinecone SDK doesn't accept 'environment' directly
    // We'll just use the API key since Pinecone can determine the proper environment
    pineconeClient = new Pinecone({
      apiKey: pineconeApiKey,
    });
    
    log('Pinecone client initialized with API key', 'pinecone');
    
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
  if (!pineconeApiKey || !pineconeEnvironment) {
    log('Pinecone API key or environment is not set', 'pinecone');
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
    
    // Convert Pinecone index list to array for processing
    const indexes: PineconeIndexInfo[] = [];
    
    for (const index of indexList) {
      try {
        const pineconeIndex = client.index(index.name);
        const stats = await pineconeIndex.describeIndexStats();
        
        const namespaces = Object.entries(stats.namespaces || {}).map(([name, data]) => ({
          name,
          vectorCount: data.recordCount
        }));
        
        indexes.push({
          name: index.name,
          dimension: index.dimension,
          metric: index.metric,
          host: index.host || '',
          spec: index.spec || {},
          status: index.status || {},
          vectorCount: stats.totalRecordCount,
          namespaces
        });
      } catch (error) {
        // If we can't get stats for an index, add with basic info
        indexes.push({
          name: index.name,
          dimension: index.dimension,
          metric: index.metric,
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
 */
export async function upsertMemoriesToPinecone(
  memories: Memory[], 
  indexName: string,
  namespace: string = 'default'
): Promise<{ success: boolean; upsertedCount: number }> {
  try {
    const client = await getPineconeClient();

    // Check if index exists
    const indexList = await client.listIndexes();
    let indexExists = false;
    
    for (const index of indexList) {
      if (index.name === indexName) {
        indexExists = true;
        break;
      }
    }

    if (!indexExists) {
      throw new Error(`Index ${indexName} does not exist in Pinecone.`);
    }

    const pineconeIndex = client.index(indexName);
    
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
            metadata: memory.metadata || {}
          }
        };
      });
      
      if (records.length > 0) {
        // Upsert records to Pinecone with namespace
        await pineconeIndex.upsert(records, { namespace });
        successCount += records.length;
      }
    }
    
    return {
      success: true,
      upsertedCount: successCount
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
    
    const queryResult = await pineconeIndex.query({
      vector: embedding,
      topK: limit,
      includeMetadata: true,
      namespace
    });
    
    return queryResult.matches.map(match => {
      const metadata = match.metadata || {};
      return {
        id: Number(metadata.id) || 0,
        content: String(metadata.content) || '',
        type: String(metadata.type) || 'prompt',
        messageId: Number(metadata.messageId) || 0,
        timestamp: String(metadata.timestamp) || new Date().toISOString(),
        similarity: match.score || 0,
        metadata: metadata.metadata || {}
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
  namespace: string = 'default',
  limit: number = 1000
): Promise<PineconeVector[]> {
  try {
    const client = await getPineconeClient();
    const pineconeIndex = client.index(indexName);
    
    // List all vector IDs in the namespace
    const stats = await pineconeIndex.describeIndexStats();
    const namespaceStats = stats.namespaces?.[namespace];
    
    if (!namespaceStats || namespaceStats.recordCount === 0) {
      return [];
    }
    
    // Fetch vectors in batches to respect rate limits
    // Since Pinecone doesn't have a simple "fetch all vectors" we have to query
    // by ID - a common approach is to fetch in sparse batches
    // This is a simplified implementation
    
    // First we'll send a query with a near-zero vector to get some IDs
    const dummyVector = Array(stats.dimension).fill(0.0001);
    const queryResponse = await pineconeIndex.query({
      vector: dummyVector,
      topK: Math.min(limit, namespaceStats.recordCount),
      includeMetadata: true,
      includeValues: true,
      namespace
    });
    
    // Transform the response into our vector format
    return queryResponse.matches.map(match => ({
      id: match.id,
      values: match.values || [],
      metadata: match.metadata || {}
    }));
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
    
    // Check if index already exists
    const indexList = await client.listIndexes();
    let indexExists = false;
    
    for (const index of indexList) {
      if (index.name === indexName) {
        indexExists = true;
        break;
      }
    }
    
    if (indexExists) {
      log(`Index ${indexName} already exists. Skipping creation.`, 'pinecone');
      return true;
    }
    
    // Create index with required spec
    await client.createIndex({
      name: indexName,
      dimension,
      metric: metric as any,
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-west-2'
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
      let currentIndex = null;
      
      for (const idx of currentIndexList) {
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