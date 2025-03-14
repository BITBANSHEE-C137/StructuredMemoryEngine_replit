import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeDatabase } from "./db";
import openai from "./utils/openai";
import anthropic from "./utils/anthropic";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertMessageSchema, insertSettingsSchema, type Model, type Settings } from "@shared/schema";
import authRouter from "./routes/auth";
import pineconeRouter from "./routes/pinecone";
import { authMiddleware, isAuthenticated } from "./middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize the database
  await initializeDatabase().catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

  const router = express.Router();
  
  // Error handling middleware
  const handleError = (err: any, res: express.Response) => {
    console.error("API Error:", err);
    
    // Handle ZodError
    if (err instanceof ZodError) {
      return res.status(400).json({ 
        error: "Validation Error", 
        details: fromZodError(err).message 
      });
    }
    
    // Handle other errors
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ error: message });
  };

  // Health check endpoint
  router.get("/health", async (req, res) => {
    const openaiStatus = await openai.validateApiKey();
    const anthropicStatus = await anthropic.validateApiKey();
    
    res.json({
      status: "ok",
      providers: {
        openai: openaiStatus ? "connected" : "error",
        anthropic: anthropicStatus ? "connected" : "error"
      }
    });
  });

  // Get settings (public)
  router.get("/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Update settings (protected)
  router.post("/settings", authMiddleware, async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(validatedData);
      res.json(settings);
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Add PATCH endpoint to support client's expectation
  router.patch("/settings", authMiddleware, async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(validatedData);
      res.json(settings);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Get all models
  router.get("/models", async (req, res) => {
    try {
      const models = await storage.getModels();
      res.json(models);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Get enabled models
  router.get("/models/enabled", async (req, res) => {
    try {
      // Get models from database
      const dbModels = await storage.getEnabledModels();
      
      // Also get models directly from APIs for the most up-to-date list
      let openaiModels: string[] = [];
      let anthropicModels: string[] = [];
      
      try {
        openaiModels = await openai.getAvailableModels();
        console.log("Available OpenAI models:", openaiModels);
      } catch (error) {
        console.error("Error fetching OpenAI models:", error);
      }
      
      try {
        anthropicModels = await anthropic.getAvailableModels();
        console.log("Available Anthropic models:", anthropicModels);
      } catch (error) {
        console.error("Error fetching Anthropic models:", error);
      }
      
      // If we have API models, update our database stored models
      if (openaiModels.length > 0 || anthropicModels.length > 0) {
        // Find models that exist in APIs but not in our DB
        const existingModelIds = dbModels.map(m => m.id);
        
        // For OpenAI, add any new models to DB
        for (const modelId of openaiModels) {
          if (!existingModelIds.includes(modelId)) {
            try {
              await storage.createModel({
                id: modelId,
                name: modelId.replace("gpt-", "GPT-").replace(/-/g, " "),
                provider: "openai",
                maxTokens: modelId.includes("32k") ? 32000 : 8000,
                isEnabled: true
              });
              console.log(`Added new OpenAI model: ${modelId}`);
            } catch (error) {
              console.error(`Error adding model ${modelId}:`, error);
            }
          }
        }
        
        // For Anthropic, add any new models to DB
        for (const modelId of anthropicModels) {
          if (!existingModelIds.includes(modelId)) {
            try {
              await storage.createModel({
                id: modelId,
                name: modelId.replace("claude-", "Claude ").replace(/-/g, " "),
                provider: "anthropic",
                maxTokens: 100000,
                isEnabled: true
              });
              console.log(`Added new Anthropic model: ${modelId}`);
            } catch (error) {
              console.error(`Error adding model ${modelId}:`, error);
            }
          }
        }
        
        // Get updated models after adding any new ones
        const updatedModels = await storage.getEnabledModels();
        return res.json(updatedModels);
      }
      
      // If we couldn't get any models from APIs, return models from DB
      res.json(dbModels);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Get chat history
  router.get("/messages", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getMessages(limit);
      res.json(messages);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Submit message and get response
  router.post("/chat", async (req, res) => {
    try {
      const { content, modelId } = req.body;
      
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Message content is required" });
      }
      
      if (!modelId || typeof modelId !== "string") {
        return res.status(400).json({ error: "Model ID is required" });
      }
      
      // Get model details
      const model = await storage.getModelById(modelId);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      
      // Get current settings
      const settings = await storage.getSettings();
      
      // Check for system-related meta-queries
      const isSystemQuery = await checkForSystemQuery(content, model, settings);
      if (isSystemQuery) {
        const { response, customContext } = isSystemQuery;
        
        // Store user message
        const userMessage = await storage.createMessage({
          content,
          role: "user",
          modelId
        });
        
        // Store assistant message with the system response
        const assistantMessage = await storage.createMessage({
          content: response,
          role: "assistant",
          modelId
        });
        
        // Return the system response
        return res.json({
          message: assistantMessage,
          context: {
            relevantMemories: customContext || []
          }
        });
      }
      
      // Normal RAG processing flow for non-system queries
      // 1. Store user message
      const userMessage = await storage.createMessage({
        content,
        role: "user",
        modelId
      });
      
      // 2. Generate embedding for the user message using the configured embedding model
      const embeddingModel = settings.defaultEmbeddingModelId || "text-embedding-ada-002";
      const embedding = await openai.generateEmbedding(content, embeddingModel);
      
      // 3. Store memory with embedding
      const userMemory = await storage.createMemory({
        content,
        embedding,
        type: "prompt",
        messageId: userMessage.id,
        metadata: { timestamp: new Date().toISOString() }
      });
      
      // 4. Retrieve relevant memories based on the embedding
      const contextSize = settings.contextSize || 5;
      // Parse the similarity threshold as a float (it's stored as a string in the DB)
      console.log(`Raw similarity threshold from settings: "${settings.similarityThreshold}"`);
      
      // Get the current setting value and parse it more carefully
      let similarityThreshold = 0.75; // Default fallback value
      
      try {
        if (settings.similarityThreshold) {
          const rawValue = settings.similarityThreshold.toString().trim();
          
          // Handle percentage format (e.g. "75%")
          if (rawValue.includes('%')) {
            similarityThreshold = parseFloat(rawValue) / 100;
          } else {
            // Handle decimal format (e.g. "0.75")
            similarityThreshold = parseFloat(rawValue);
          }
          
          // Check for NaN and apply limits
          if (isNaN(similarityThreshold)) {
            console.warn('Invalid similarity threshold value - using default 0.75');
            similarityThreshold = 0.75;
          }
        }
      } catch (error) {
        console.error('Error parsing similarity threshold:', error);
      }
      
      // Ensure the threshold is a valid value between 0 and 1
      similarityThreshold = Math.max(0, Math.min(1, similarityThreshold));
      
      console.log(`Processed similarity threshold: ${similarityThreshold} (${similarityThreshold * 100}%)`);
      
      // Pass both contextSize and similarityThreshold to the storage method
      const relevantMemories = await storage.queryMemoriesByEmbedding(
        embedding, 
        contextSize,
        similarityThreshold
      );
      
      // 5. Format context from relevant memories
      let context = '';
      if (relevantMemories.length > 0) {
        context = "Here are some relevant past interactions:\n\n" + 
          relevantMemories
            .map((memory, i) => `[Memory ${i + 1}] ${memory.content}`)
            .join("\n\n");
      }
      
      // Add metadata about the current query and model
      context += `\n\nMETADATA:
- Current model: ${model.name} (${model.provider})
- Max context size: ${contextSize} relevant memories
- Current time: ${new Date().toISOString()}`;
      
      // 6. Check if Pinecone is available for long-term memory
      const isPineconeAvailable = await storage.isPineconeAvailable();
      
      // 7. Generate response based on provider with tiered RAG approach
      let response = '';
      // Use 'jarvis' as the default useCase to match the Iron Man Jarvis concept
      const useCase = 'jarvis';
      
      if (model.provider === 'openai') {
        response = await openai.generateResponse(
          content, 
          context, 
          modelId, 
          isPineconeAvailable, 
          useCase
        );
      } else if (model.provider === 'anthropic') {
        response = await anthropic.generateResponse(
          content, 
          context, 
          modelId, 
          isPineconeAvailable, 
          useCase
        );
      } else {
        return res.status(400).json({ error: "Unsupported model provider" });
      }
      
      // 7. Store assistant message
      const assistantMessage = await storage.createMessage({
        content: response,
        role: "assistant",
        modelId
      });
      
      // 8. Generate embedding for the response using the same embedding model
      const responseEmbedding = await openai.generateEmbedding(response, embeddingModel);
      
      // 9. Store memory with embedding
      const assistantMemory = await storage.createMemory({
        content: response,
        embedding: responseEmbedding,
        type: "response",
        messageId: assistantMessage.id,
        metadata: { 
          timestamp: new Date().toISOString(),
          relevantMemories: relevantMemories.map(m => m.id)
        }
      });
      
      // 10. Return response with metadata
      res.json({
        message: assistantMessage,
        context: {
          relevantMemories: relevantMemories.map(m => ({
            id: m.id, 
            content: m.content,
            similarity: m.similarity
          }))
        }
      });
    } catch (err) {
      handleError(err, res);
    }
  });
  
  // Helper function to check for system-related meta-queries and handle them directly
  async function checkForSystemQuery(content: string, model: Model, settings: Settings): Promise<{ response: string, customContext?: any[] } | false> {
    const lowercaseContent = content.toLowerCase().trim();
    
    // Check if Pinecone is available
    const isPineconeAvailable = await storage.isPineconeAvailable();
    const pineconeStatus = isPineconeAvailable ? "active and available" : "not configured";
    
    // Check for queries about the current model or identity
    if (
      lowercaseContent.includes("which model") ||
      lowercaseContent.includes("what model") ||
      lowercaseContent.includes("model are you") ||
      lowercaseContent.includes("model version") ||
      lowercaseContent.includes("model type") ||
      lowercaseContent.includes("are you gpt") ||
      lowercaseContent.includes("are you claude") ||
      lowercaseContent.includes("who are you") ||
      lowercaseContent.includes("what are you") ||
      lowercaseContent.includes("your name")
    ) {
      return {
        response: `I am Jarvis, sir. I'm powered by the ${model.name} model from ${model.provider}, with a maximum context capacity of ${model.maxTokens} tokens. 

My memory system uses a two-tiered approach:
- Short-term memory (PGVector): Contains ${settings.contextSize} most relevant memories per query with a similarity threshold of ${settings.similarityThreshold}
- Long-term memory (Pinecone): ${pineconeStatus} for archival knowledge retrieval

Is there anything specific about my capabilities you'd like to know?`
      };
    }
    
    // Check for queries about recent conversations
    if (
      lowercaseContent.includes("summarize recent chats") ||
      lowercaseContent.includes("summarize conversations") ||
      lowercaseContent.includes("recent messages") ||
      lowercaseContent.includes("chat history") ||
      lowercaseContent.includes("previous messages") ||
      lowercaseContent.includes("last 24 hours") ||
      lowercaseContent.includes("what did we talk about")
    ) {
      try {
        // Get the most recent messages (up to 30)
        const recentMessages = await storage.getMessages(30);
        
        // Format them for the response in Jarvis style
        const formattedMessages = recentMessages
          .map(msg => `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role === 'user' ? 'You' : 'Jarvis'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
          .join('\n\n');
        
        return {
          response: `I've compiled a summary of our recent conversations, sir:\n\n${formattedMessages}\n\nIs there a specific part of our conversation you'd like me to elaborate on?`,
          customContext: recentMessages.map(m => ({ 
            id: m.id,
            content: m.content,
            similarity: 1.0
          }))
        };
      } catch (error) {
        console.error("Error retrieving recent messages:", error);
        return {
          response: "I attempted to retrieve our conversation history, sir, but encountered a system error. Perhaps we could try a different query?"
        };
      }
    }
    
    // Check for queries about system settings
    if (
      lowercaseContent.includes("system settings") ||
      lowercaseContent.includes("current settings") ||
      lowercaseContent.includes("memory settings") ||
      lowercaseContent.includes("how are you configured") ||
      lowercaseContent.includes("what are your settings") ||
      lowercaseContent.includes("configuration") ||
      lowercaseContent.includes("diagnostic")
    ) {
      // Get pinecone stats if available
      let pineconeInfo = "";
      if (isPineconeAvailable) {
        try {
          const pineconeSettings = await storage.getPineconeSettings();
          pineconeInfo = `
- Long-term Memory (Pinecone): Enabled
- Active Index: ${pineconeSettings.activeIndexName || "None"}
- Namespace: ${pineconeSettings.namespace || "default"}
- Last Sync: ${pineconeSettings.lastSyncTimestamp ? new Date(pineconeSettings.lastSyncTimestamp).toLocaleString() : "Never"}`;
        } catch (error) {
          console.error("Error fetching Pinecone settings:", error);
          pineconeInfo = "\n- Long-term Memory (Pinecone): Error retrieving settings";
        }
      } else {
        pineconeInfo = "\n- Long-term Memory (Pinecone): Not configured";
      }
      
      return {
        response: `System diagnostics ready, sir. Current configuration:
        
- Primary AI: ${model.name} (${model.provider})
- Default Model: ${settings.defaultModelId}
- Embedding Model: ${settings.defaultEmbeddingModelId}
- Short-term Memory Size: ${settings.contextSize} memories per query
- Memory Similarity Threshold: ${settings.similarityThreshold}${pineconeInfo}

All systems are operational. Memory functions can be managed through the settings panel if adjustments are needed.`
      };
    }
    
    // Check for Pinecone recall queries
    if (
      (lowercaseContent.includes("recall") || 
       lowercaseContent.includes("search long term") || 
       lowercaseContent.includes("search pinecone") || 
       lowercaseContent.includes("check long term") ||
       lowercaseContent.includes("retrieve from pinecone") ||
       lowercaseContent.includes("check pinecone")
      ) && isPineconeAvailable
    ) {
      return {
        response: `I'll initiate a search in the long-term memory archives, sir. What specific information would you like me to retrieve? Please provide some keywords or a specific topic you'd like me to search for.`
      };
    }
    
    // Not a system query
    return false;
  }

  // Get memories with pagination
  router.get("/memories", async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 10;
      
      const result = await storage.getMemories(page, pageSize);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Clear all memories endpoint (protected)
  router.post("/memories/clear", authMiddleware, async (req, res) => {
    try {
      const result = await storage.clearAllMemories();
      res.json({ 
        success: true, 
        count: result.count, 
        message: `Successfully cleared ${result.count} memories and messages` 
      });
    } catch (err) {
      handleError(err, res);
    }
  });

  // Register auth router
  app.use("/api/auth", authRouter);
  
  // Register Pinecone router
  app.use("/api/pinecone", pineconeRouter);
  
  // Register all API routes with /api prefix
  app.use("/api", router);

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
