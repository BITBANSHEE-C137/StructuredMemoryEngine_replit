// Constants and configuration for the client application

export const APP_NAME = "Structured Memory Engine";

export const DEFAULT_SYSTEM_MESSAGE = {
  id: 0,
  content: "Welcome to the Structured Memory Engine! I'm your RAG-powered assistant. I can remember our conversation context through vector embeddings stored in a local PGVector database. Ask me anything, and I'll use relevant memories to provide better responses.",
  role: "assistant" as const,
  timestamp: new Date().toISOString(),
  modelId: "system"
};

export const MEMORY_PANEL_BREAKPOINT = 768; // px

export const DEFAULT_SETTINGS = {
  contextSize: 5,
  similarityThreshold: "0.75",
  defaultModelId: "gpt-4o",
  defaultEmbeddingModelId: "text-embedding-ada-002",
  autoClearMemories: false
};

export const API_ROUTES = {
  CHAT: "/api/chat",
  MESSAGES: "/api/messages",
  MODELS: "/api/models",
  MODELS_ENABLED: "/api/models/enabled",
  SETTINGS: "/api/settings",
  HEALTH: "/api/health"
};

export const ERROR_MESSAGES = {
  FETCH_MESSAGES: "Failed to load messages",
  FETCH_MODELS: "Failed to load AI models",
  FETCH_SETTINGS: "Failed to load settings",
  SEND_MESSAGE: "Failed to send message",
  UPDATE_SETTINGS: "Failed to update settings",
  FETCH_API_STATUS: "Failed to check API status"
};
