import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeDatabase } from "./db";
import openai from "./utils/openai";
import anthropic from "./utils/anthropic";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertMessageSchema, insertSettingsSchema } from "@shared/schema";

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

  // Get settings
  router.get("/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Update settings
  router.post("/settings", async (req, res) => {
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
      const relevantMemories = await storage.queryMemoriesByEmbedding(
        embedding, 
        contextSize
      );
      
      // 5. Format context from relevant memories
      let context = '';
      if (relevantMemories.length > 0) {
        context = "Here are some relevant past interactions:\n\n" + 
          relevantMemories
            .map((memory, i) => `[Memory ${i + 1}] ${memory.content}`)
            .join("\n\n");
      }
      
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

  // Register all routes with /api prefix
  app.use("/api", router);

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
