import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeDatabase } from "./db";
import openai from "./utils/openai";
import anthropic from "./utils/anthropic";
import { processContentForEmbedding, applyHybridRanking } from "./utils/content-processor";
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
      
      // 2. Process and generate embedding for the user message using the configured embedding model
      const embeddingModel = settings.defaultEmbeddingModelId || "text-embedding-3-small";
      
      // Process content before embedding to improve quality
      const processedContent = processContentForEmbedding(content, {
        clean: true,
        extract: true,
        chunk: false
      }) as string;
      
      console.log(`Content processing: Raw length ${content.length}, Processed length ${processedContent.length}`);
      const embedding = await openai.generateEmbedding(processedContent, embeddingModel);
      
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
      console.log(`=== SIMILARITY THRESHOLD DEBUGGING ===`);
      console.log(`Raw similarity threshold from settings: "${settings.similarityThreshold}" (type: ${typeof settings.similarityThreshold})`);
      
      // Get the current setting value and parse it more carefully
      let similarityThreshold = 0.75; // Default fallback value
      
      try {
        if (settings.similarityThreshold) {
          const rawValue = settings.similarityThreshold.toString().trim();
          console.log(`Trimmed raw value: "${rawValue}"`);
          
          // Handle percentage format (e.g. "85%")
          if (rawValue.includes('%')) {
            similarityThreshold = parseFloat(rawValue) / 100;
            console.log(`Percentage format detected, parsed as: ${similarityThreshold}`);
          } else {
            // Handle decimal format (e.g. "0.85")
            similarityThreshold = parseFloat(rawValue);
            console.log(`Decimal format detected, parsed as: ${similarityThreshold}`);
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
      
      console.log(`Final parsed similarity threshold: ${similarityThreshold} (${similarityThreshold * 100}%)`);
      if (similarityThreshold !== parseFloat(settings.similarityThreshold)) {
        console.log(`Note: Parsed value differs from raw settings value - this is the issue we're fixing`);
      }
      console.log(`=== END THRESHOLD DEBUGGING ===`);
      
      console.log(`Processed similarity threshold: ${similarityThreshold} (${similarityThreshold * 100}%)`);
      
      // Pass both contextSize and similarityThreshold to the storage method
      let relevantMemories = await storage.queryMemoriesByEmbedding(
        embedding, 
        contextSize * 2, // Request more memories than needed to allow hybrid ranking to filter
        similarityThreshold * 0.9 // Slightly lower threshold to allow keyword-relevant items
      );
      
      // Apply hybrid ranking to improve results with keyword matching
      console.log(`Retrieved ${relevantMemories.length} memories via vector similarity`);
      
      // Apply hybrid ranking with both vector similarity and keyword matching
      relevantMemories = applyHybridRanking(content, relevantMemories, similarityThreshold);
      
      // Limit to requested context size after hybrid ranking
      relevantMemories = relevantMemories.slice(0, contextSize);
      
      console.log(`After hybrid ranking: ${relevantMemories.length} memories selected`);
      
      // Add debug information to memory metadata without type errors
      relevantMemories.forEach(memory => {
        // Cast to any to avoid TypeScript errors for dynamic properties
        const memoryAny = memory as any;
        
        // Use optional chaining for safer access
        const originalSim = memoryAny.originalSimilarity?.toFixed(2) || 'N/A';
        const keywordScore = memoryAny.keywordScore?.toFixed(2) || 'N/A';
        const hybridScore = memoryAny.hybridScore?.toFixed(2) || 'N/A';
        
        console.log(`Memory ID ${memory.id}: Vector similarity ${originalSim}, Keyword score ${keywordScore}, Hybrid score ${hybridScore}`);
      });
      
      // 5. Format context from relevant memories
      let context = '';
      if (relevantMemories.length > 0) {
        context = "Here are some relevant past interactions:\n\n" + 
          relevantMemories
            .map((memory, i) => `[Memory ${i + 1}] ${memory.content}`)
            .join("\n\n");
      }
      
      // Add special system context to help guide the model
      context += `\n\nIMPORTANT SYSTEM NOTES:
1. You are the Structured Memory Engine, a RAG-based AI assistant that uses vector similarity to find relevant memories.
2. The current model you're using is: ${model.name} (${model.provider})
3. You have access to ${contextSize} relevant memories for each query.
4. If asked about your configuration or settings, you can directly answer with this information.
5. For queries like "summarize recent chats" or "what model is this?", you can access this system information to answer.`;
      
      // 6. Generate response based on provider
      let response = '';
      if (model.provider === 'openai') {
        response = await openai.generateResponse(content, context, modelId);
      } else if (model.provider === 'anthropic') {
        response = await anthropic.generateResponse(content, context, modelId);
      } else {
        return res.status(400).json({ error: "Unsupported model provider" });
      }
      
      // 7. Store assistant message
      const assistantMessage = await storage.createMessage({
        content: response,
        role: "assistant",
        modelId
      });
      
      // 8. Process and generate embedding for the response using the same embedding model
      // Process the assistant's response for better embedding
      const processedResponse = processContentForEmbedding(response, {
        clean: true,
        extract: true,
        chunk: false
      }) as string;
      
      console.log(`Response processing: Raw length ${response.length}, Processed length ${processedResponse.length}`);
      const responseEmbedding = await openai.generateEmbedding(processedResponse, embeddingModel);
      
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
    
    // Check for queries about the current model
    if (
      lowercaseContent.includes("which model") ||
      lowercaseContent.includes("what model") ||
      lowercaseContent.includes("model are you") ||
      lowercaseContent.includes("model version") ||
      lowercaseContent.includes("model type") ||
      lowercaseContent.includes("are you gpt") ||
      lowercaseContent.includes("are you claude")
    ) {
      return {
        response: `You're interacting with the Structured Memory Engine using the ${model.name} model from ${model.provider}. This model can handle up to ${model.maxTokens} tokens of context. The engine is configured to use ${settings.contextSize} relevant memories for each query with a similarity threshold of ${settings.similarityThreshold}.`
      };
    }
    
    // Check for queries about recent conversations
    if (
      lowercaseContent.includes("summarize recent chats") ||
      lowercaseContent.includes("summarize conversations") ||
      lowercaseContent.includes("recent messages") ||
      lowercaseContent.includes("chat history") ||
      lowercaseContent.includes("previous messages") ||
      lowercaseContent.includes("last 24 hours")
    ) {
      try {
        // Get the most recent messages (up to 30)
        const recentMessages = await storage.getMessages(30);
        
        // Format them for the response
        const formattedMessages = recentMessages
          .map(msg => `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
          .join('\n\n');
        
        return {
          response: `Here's a summary of recent conversations:\n\n${formattedMessages}`,
          customContext: recentMessages.map(m => ({ 
            id: m.id,
            content: m.content,
            similarity: 1.0
          }))
        };
      } catch (error) {
        console.error("Error retrieving recent messages:", error);
        return {
          response: "I tried to retrieve your recent conversation history, but encountered an error. Could you please try a different query?"
        };
      }
    }
    
    // Check for queries about content processing or embedding
    if (
      lowercaseContent.includes("content processing") ||
      lowercaseContent.includes("embedding quality") ||
      lowercaseContent.includes("how do you process") ||
      lowercaseContent.includes("content cleaning") ||
      lowercaseContent.includes("text extraction") ||
      lowercaseContent.includes("embedding model") ||
      lowercaseContent.includes("hybrid search") ||
      lowercaseContent.includes("search algorithm") ||
      lowercaseContent.includes("search approach") ||
      lowercaseContent.includes("keyword searching")
    ) {
      return {
        response: `The Structured Memory Engine uses advanced content processing and hybrid search techniques to optimize memory retrieval:

1. Content Cleaning: I remove UI elements, formatting, and standardize spacing to focus on meaningful content.
2. Key Information Extraction: I identify and prioritize important sentences, questions, and definitive statements.
3. Embedding Generation: I use OpenAI's text-embedding-3-small model (1536 dimensions) to create semantic vectors.
4. Hybrid Search: I combine vector similarity (${settings.similarityThreshold} threshold) with keyword matching for optimal results:
   - Vector similarity captures semantic meaning even when different words are used
   - Keyword matching ensures highly relevant exact matches aren't missed
   - Combined scoring gives priority to memories that match both approaches

This hybrid approach ensures that when you ask questions, I retrieve the most relevant memories by understanding both the semantic meaning and specific keywords in your query, providing better contextual understanding than either approach alone.`
      };
    }
    
    // Check for queries about system settings
    if (
      lowercaseContent.includes("system settings") ||
      lowercaseContent.includes("current settings") ||
      lowercaseContent.includes("memory settings") ||
      lowercaseContent.includes("how are you configured") ||
      lowercaseContent.includes("what are your settings")
    ) {
      return {
        response: `The Structured Memory Engine is currently configured with the following settings:
        
- Default Model: ${settings.defaultModelId}
- Default Embedding Model: ${settings.defaultEmbeddingModelId}
- Context Size: ${settings.contextSize} memories per query
- Similarity Threshold: ${settings.similarityThreshold}

These settings determine how the system processes your queries and retrieves relevant context from past conversations. You can manually clear all memories through the settings menu.`
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
