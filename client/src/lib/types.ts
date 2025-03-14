// Types for the client application

export interface Message {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  modelId: string;
  // Add optional property for relevant memories
  relevantMemories?: RelevantMemory[];
  // Add optional context property for additional data like similarity threshold
  context?: {
    similarityThreshold?: number;
    thresholdDetails?: {
      baseThreshold: number;      // Original threshold from settings
      adjustmentFactor: number;   // Adjustment factor (lower for questions, higher for statements)
      adjustedThreshold: number;  // Final threshold after adjustment
      isQuestion: boolean;        // Whether the query was classified as a question
    };
    [key: string]: any;
  };
}

export interface Memory {
  id: number;
  content: string;
  embedding: string;
  type: 'prompt' | 'response';
  messageId: number;
  timestamp: string;
  metadata: any;
  similarity?: number;
}

export interface ChatResponse {
  message: Message;
  context: {
    relevantMemories: {
      id: number;
      content: string;
      similarity: number;
    }[];
    similarityThreshold?: number; // Added similarity threshold used for query
    thresholdDetails?: {
      baseThreshold: number;      // Original threshold from settings
      adjustmentFactor: number;   // Adjustment factor (lower for questions, higher for statements)
      adjustedThreshold: number;  // Final threshold after adjustment
      isQuestion: boolean;        // Whether the query was classified as a question
    };
  };
}

export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic';
  maxTokens: number;
  isEnabled: boolean;
}

export interface Settings {
  id: number;
  contextSize: number;
  similarityThreshold: string;
  defaultModelId: string;
  defaultEmbeddingModelId: string;
  autoClearMemories: boolean;
}

export interface RelevantMemory {
  id: number;
  content: string;
  similarity: number;
}

export interface ApiStatus {
  status: string;
  providers: {
    openai: 'connected' | 'error';
    anthropic: 'connected' | 'error';
  };
}
