import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { 
  listPineconeIndexes, 
  createPineconeIndexIfNotExists, 
  deletePineconeIndex,
  wipePineconeIndex 
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
    
    if (!indexName) {
      return res.status(400).json({ error: 'Index name is required' });
    }
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const result = await storage.syncMemoriesToPinecone(indexName, namespace);
    
    res.json(result);
  } catch (error) {
    log(`Error syncing memories to Pinecone: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to sync memories to Pinecone' });
  }
});

// Hydrate pgvector from Pinecone
router.post('/hydrate', async (req: Request, res: Response) => {
  try {
    const { indexName, namespace = 'default', limit = 1000 } = req.body;
    
    if (!indexName) {
      return res.status(400).json({ error: 'Index name is required' });
    }
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const result = await storage.hydrateFromPinecone(indexName, namespace, limit);
    
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
    const { namespace = 'default' } = req.body;
    
    const isPineconeAvailable = await storage.isPineconeAvailable();
    
    if (!isPineconeAvailable) {
      return res.status(503).json({ 
        error: 'Pinecone service is not available',
        message: 'Check your API key and connection'
      });
    }
    
    const result = await wipePineconeIndex(name, namespace);
    
    if (result) {
      res.json({ success: true, message: `Index ${name} wiped successfully in namespace ${namespace}` });
    } else {
      res.status(500).json({ error: `Failed to wipe index ${name}` });
    }
  } catch (error) {
    log(`Error wiping Pinecone index: ${error}`, 'pinecone');
    res.status(500).json({ error: 'Failed to wipe Pinecone index' });
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

export default router;