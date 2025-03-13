// Types for the client application

export interface Message {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  modelId: string;
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
