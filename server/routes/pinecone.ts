import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { 
  listPineconeIndexes, 
  createPineconeIndexIfNotExists, 
  deletePineconeIndex,
  wipePineconeIndex,
  fetchVectorsFromPinecone,
  getPineconeClient
} from '../utils/pinecone';
import { log } from '../vite';

const router = Router();

// Get Pinecone settings
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await storage.getPineconeSettings();
    res.json(settings);
  } catch (error) {
    log(`Error fetching Pinecone settings: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to fetch Pinecone settings' });
  }
});

// Update Pinecone settings
router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const updatedSettings = await storage.updatePineconeSettings(req.body);
    res.json(updatedSettings);
  } catch (error) {
    log(`Error updating Pinecone settings: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to update Pinecone settings' });
  }
});

// List Pinecone indexes
router.get('/indexes', async (_req: Request, res: Response) => {
  try {
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const indexes = await listPineconeIndexes();
    res.json(indexes);
  } catch (error) {
    log(`Error listing Pinecone indexes: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to list Pinecone indexes' });
  }
});

// Create a new Pinecone index
router.post('/indexes', async (req: Request, res: Response) => {
  try {
    const { name, dimension = 1536, metric = 'cosine' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Index name is required' });
    }
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const result = await createPineconeIndexIfNotExists(name, dimension, metric);
    
    if (result) {
      res.json({ success: true, message: `Index ${name} created successfully` });
    } else {
      res.status(500).json({ error: `Failed to create index ${name}` });
    }
  } catch (error) {
    log(`Error creating Pinecone index: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to create Pinecone index' });
  }
});

// Delete a Pinecone index
router.delete('/indexes/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const result = await deletePineconeIndex(name);
    
    if (result) {
      res.json({ success: true, message: `Index ${name} deleted successfully` });
    } else {
      res.status(500).json({ error: `Failed to delete index ${name}` });
    }
  } catch (error) {
    log(`Error deleting Pinecone index: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to delete Pinecone index' });
  }
});

// Sync memories from pgvector to Pinecone
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { indexName, namespace = 'default' } = req.body;
    log(`Received request to sync memories to Pinecone index ${indexName} in namespace ${namespace}`, 'pinecone');
    
    if (!indexName) {
      return res.status(400).json({ error: 'Index name is required' });
    }
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      log(`Cannot sync - Pinecone service is not available`, 'pinecone');
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    // Get enhanced sync result with deduplication information
    log(`Starting sync process to Pinecone index ${indexName}`, 'pinecone');
    const syncResult = await storage.syncMemoriesToPinecone(indexName, namespace);
    log(`Sync completed with result: ${JSON.stringify({
      success: syncResult.success,
      count: syncResult.count,
      duplicateCount: syncResult.duplicateCount || 0,
      dedupRate: syncResult.dedupRate ? syncResult.dedupRate.toFixed(1) + '%' : '0%',
      totalProcessed: syncResult.totalProcessed || syncResult.count,
      vectorCount: syncResult.vectorCount || 0
    })}`, 'pinecone');
    
    // Return complete response with all deduplication data and metadata
    res.json({
      success: syncResult.success,
      count: syncResult.count,
      duplicateCount: syncResult.duplicateCount || 0,
      dedupRate: syncResult.dedupRate || 0,
      totalProcessed: syncResult.totalProcessed || syncResult.count,
      vectorCount: syncResult.vectorCount || 0,
      indexName: syncResult.indexName || indexName,
      namespace: syncResult.namespace || namespace,
      timestamp: syncResult.timestamp || new Date().toISOString()
    });
    
    // Refresh stats after successful sync to update vector counts
    try {
      log(`Fetching updated stats after sync operation`, 'pinecone');
      const indexes = await listPineconeIndexes();
      const updatedIndex = indexes.find(idx => idx.name === indexName);
      if (updatedIndex) {
        log(`Index ${indexName} now has ${updatedIndex.vectorCount} total vectors`, 'pinecone');
        if (updatedIndex.namespaces && updatedIndex.namespaces.length > 0) {
          const namespaceInfo = updatedIndex.namespaces.find(ns => ns.name === namespace);
          if (namespaceInfo) {
            log(`Namespace ${namespace} has ${namespaceInfo.vectorCount} vectors`, 'pinecone');
          }
        }
      }
    } catch (statsError) {
      log(`Error checking stats after sync: ${statsError}`, 'pinecone');
    }
  } catch (error) {
    log(`Error syncing memories to Pinecone: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to sync memories to Pinecone' });
  }
});

// Hydrate pgvector from Pinecone
router.post('/hydrate', async (req: Request, res: Response) => {
  try {
    const { indexName, namespace = 'default', limit = 1000 } = req.body;
    
    log(`=== HYDRATION DEBUG ===`, 'pinecone');
    log(`Request to hydrate from Pinecone: index=${indexName}, namespace=${namespace}, limit=${limit}`, 'pinecone');
    
    if (!indexName) {
      log(`Error: Index name is required`, 'pinecone');
      return res.status(400).json({ error: 'Index name is required' });
    }
    
    // Check database state before hydration
    try {
      const [{ count: preCount }] = await db.select({ count: sql`count(*)` }).from(memories);
      log(`Pre-hydration memory count: ${preCount}`, 'pinecone');
    } catch (countErr) {
      log(`Error checking pre-hydration count: ${countErr}`, 'pinecone');
    }
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    log(`Pinecone availability check: ${isPineconeAvailable}`, 'pinecone');
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    log(`Starting hydration process...`, 'pinecone');
    const result = await storage.hydrateFromPinecone(indexName, namespace, limit);
    
    // Check database state after hydration
    try {
      const [{ count: postCount }] = await db.select({ count: sql`count(*)` }).from(memories);
      log(`Post-hydration memory count: ${postCount}`, 'pinecone');
      
      if (postCount !== Number(result.count)) {
        log(`WARNING: Memory count discrepancy! DB shows ${postCount} but result says ${result.count}`, 'pinecone');
        
        // Force update the count in the result to match reality
        result.count = postCount;
      }
    } catch (countErr) {
      log(`Error checking post-hydration count: ${countErr}`, 'pinecone');
    }
    
    log(`Hydration completed with result: ${JSON.stringify({
      success: result.success,
      count: result.count,
      duplicateCount: result.duplicateCount || 0,
      dedupRate: result.dedupRate ? result.dedupRate.toFixed(1) + '%' : '0%',
      totalProcessed: result.totalProcessed || result.count,
      vectorCount: result.vectorCount || 0
    })}`, 'pinecone');
    log(`=== END HYDRATION DEBUG ===`, 'pinecone');
    
    res.json(result);
  } catch (error) {
    log(`Error hydrating from Pinecone: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to hydrate from Pinecone' });
  }
});

// Wipe all vectors from an index
router.post('/indexes/:name/wipe', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    let { namespace = 'default' } = req.body;
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    // First get current stats to find where vectors actually exist
    try {
      log(`Checking existing namespaces for index ${name}`, 'pinecone');
      const client = await getPineconeClient();
      const pineconeIndex = client.index(name);
      const stats = await pineconeIndex.describeIndexStats();
      
      // Check if we have empty namespaces from blank to default
      if (namespace === 'default' && (!stats.namespaces?.default || stats.namespaces.default.recordCount === 0)) {
        // Check if there are vectors in the blank namespace
        if (stats.namespaces?.[''] && stats.namespaces[''].recordCount > 0) {
          log(`No vectors in namespace 'default' but found ${stats.namespaces[''].recordCount} vectors in blank namespace`, 'pinecone');
          namespace = ''; // Switch to blank namespace
        }
      }
      
      log(`Using namespace '${namespace}' for wipe operation`, 'pinecone');
    } catch (statsError) {
      log(`Error checking namespaces: ${statsError}. Will continue with requested namespace.`, 'pinecone');
    }
    
    // Now wipe the appropriate namespace
    const result = await wipePineconeIndex(name, namespace);
    
    if (result) {
      // If we wiped the blank namespace, also attempt to wipe default as a precaution
      if (namespace === '' && namespace !== 'default') {
        try {
          await wipePineconeIndex(name, 'default');
        } catch (secondWipeError) {
          // Ignore errors from second wipe attempt
        }
      }
      
      const displayNamespace = namespace === '' ? 'blank namespace' : `namespace '${namespace}'`;
      res.json({ success: true, message: `Index ${name} wiped successfully in ${displayNamespace}` });
    } else {
      res.status(500).json({ error: `Failed to wipe index ${name}` });
    }
  } catch (error) {
    log(`Error wiping Pinecone index: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to wipe Pinecone index' });
  }
});

// Get stats for active Pinecone index
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const settings = await storage.getPineconeSettings();
    
    if (!settings.isEnabled || !settings.activeIndexName) {
      return res.json({ 
        enabled: false,
        vectorCount: 0,
        activeIndex: null,
        namespaces: []
      });
    }
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const indexes = await listPineconeIndexes();
    const activeIndex = indexes.find(index => index.name === settings.activeIndexName);
    
    if (!activeIndex) {
      return res.json({
        enabled: true,
        vectorCount: 0,
        activeIndex: settings.activeIndexName,
        namespaces: []
      });
    }
    
    // Get the pinecone settings to check for last sync/hydrate operations
    const pineconeSettings = await storage.getPineconeSettings();
    
    // Calculate deduplication metrics if available
    let lastSyncDedupRate = null;
    let lastHydrateDedupRate = null;
    let avgDedupRate = null;
    
    // Attempt to query the database for recent sync operations to extract deduplication metrics
    try {
      // You could add a db query here to get historical deduplication metrics from recent operations
      // For now, we'll use placeholder values if they exist in the settings
      if (pineconeSettings.metadata && typeof pineconeSettings.metadata === 'object') {
        const metadata = pineconeSettings.metadata as any;
        
        if (metadata.lastSyncResult && metadata.lastSyncResult.dedupRate !== undefined) {
          lastSyncDedupRate = metadata.lastSyncResult.dedupRate;
        }
        
        if (metadata.lastHydrateResult && metadata.lastHydrateResult.dedupRate !== undefined) {
          lastHydrateDedupRate = metadata.lastHydrateResult.dedupRate;
        }
        
        // Calculate average if both metrics are available
        if (lastSyncDedupRate !== null && lastHydrateDedupRate !== null) {
          avgDedupRate = (lastSyncDedupRate + lastHydrateDedupRate) / 2;
        } else if (lastSyncDedupRate !== null) {
          avgDedupRate = lastSyncDedupRate;
        } else if (lastHydrateDedupRate !== null) {
          avgDedupRate = lastHydrateDedupRate;
        }
      }
    } catch (err) {
      log(`Error getting deduplication metrics: ${err}`, 'pinecone');
      // Continue without deduplication metrics
    }
    
    res.json({
      enabled: true,
      vectorCount: activeIndex.vectorCount,
      activeIndex: settings.activeIndexName,
      namespaces: activeIndex.namespaces || [],
      // Include deduplication metrics if available
      ...(lastSyncDedupRate !== null && { lastSyncDedupRate }),
      ...(lastHydrateDedupRate !== null && { lastHydrateDedupRate }),
      ...(avgDedupRate !== null && { avgDedupRate })
    });
  } catch (error) {
    log(`Error fetching Pinecone stats: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to fetch Pinecone stats' });
  }
});

// Get direct vector data from a specific index
router.get('/indexes/:name/vectors', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { namespace = 'default', limit = 100 } = req.query;
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const vectors = await fetchVectorsFromPinecone(
      name, 
      namespace as string, 
      parseInt(limit as string) || 100
    );
    
    // Return the vectors but limit metadata size for response performance
    const simplifiedVectors = vectors.map((v: any) => ({
      id: v.id,
      hasValues: Array.isArray(v.values) && v.values.length > 0,
      valuesDimension: Array.isArray(v.values) ? v.values.length : 0,
      metadata: v.metadata ? {
        type: v.metadata.type,
        messageId: v.metadata.messageId,
        content: typeof v.metadata.content === 'string' && v.metadata.content.length > 100 
          ? v.metadata.content.substring(0, 100) + '...' 
          : v.metadata.content,
        ...v.metadata
      } : null
    }));
    
    res.json({
      indexName: name,
      namespace: namespace,
      count: vectors.length,
      vectors: simplifiedVectors,
      rawSample: vectors.length > 0 ? vectors[0] : null
    });
  } catch (error) {
    log(`Error fetching vectors from index ${req.params.name}: ${error}`, 'pinecone');
    res.status(500).json({ 
      error: 'Failed to fetch vectors',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Check if Pinecone is available
router.get('/status', async (_req: Request, res: Response) => {
  try {
    log('Checking Pinecone availability...', 'pinecone');
    log(`PINECONE_API_KEY exists: ${!!process.env.PINECONE_API_KEY}`, 'pinecone');
    
    const isAvailable = await storage.isPineconeAvailable();
    log(`Pinecone availability result: ${isAvailable}`, 'pinecone');
    
    // Don't expose sensitive environment details in the response 
    res.json({ 
      available: isAvailable,
      status: isAvailable ? 'connected' : 'disconnected',
      configured: !!process.env.PINECONE_API_KEY
    });
  } catch (error) {
    log(`Error checking Pinecone status: ${error}`, 'pinecone');
    res.status(500).json({ 
      error: 'Failed to check Pinecone status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint to reset deduplication metrics
router.post('/reset-metrics', async (_req: Request, res: Response) => {
  try {
    const pineconeSettings = await storage.getPineconeSettings();
    
    // If there's no metadata, nothing to reset
    if (!pineconeSettings.metadata) {
      return res.json({ 
        success: true, 
        message: "No metrics to reset" 
      });
    }
    
    // Create a copy of existing metadata
    const updatedMetadata = { ...pineconeSettings.metadata as any };
    
    // Reset the deduplication metrics
    if (updatedMetadata.lastSyncResult) {
      updatedMetadata.lastSyncResult.dedupRate = 0;
      updatedMetadata.lastSyncResult.duplicateCount = 0;
      
      // Preserve other data for historical reference
      updatedMetadata.lastSyncResult.wasReset = true;
      updatedMetadata.lastSyncResult.resetTimestamp = new Date().toISOString();
    }
    
    if (updatedMetadata.lastHydrateResult) {
      updatedMetadata.lastHydrateResult.dedupRate = 0;
      updatedMetadata.lastHydrateResult.duplicateCount = 0;
      
      // Preserve other data for historical reference
      updatedMetadata.lastHydrateResult.wasReset = true;
      updatedMetadata.lastHydrateResult.resetTimestamp = new Date().toISOString();
    }
    
    // Update the settings with the modified metadata
    await storage.updatePineconeSettings({
      metadata: updatedMetadata
    });
    
    res.json({ 
      success: true, 
      message: "Deduplication metrics reset successfully" 
    });
  } catch (error) {
    log(`Error resetting deduplication metrics: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to reset deduplication metrics' });
  }
});

export default router;