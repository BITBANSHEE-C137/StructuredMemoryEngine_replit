import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './chat-message';
import { Message, Model, RelevantMemory } from '@/lib/types';
import { useAutosizeTextarea } from '@/lib/hooks';
import { DEFAULT_SYSTEM_MESSAGE } from '@/lib/constants';

interface ChatInterfaceProps {
  messages: Message[];
  models: Model[];
  isLoading: boolean;
  selectedModelId: string;
  selectedEmbeddingModelId: string;
  onModelChange: (modelId: string) => void;
  onEmbeddingModelChange: (modelId: string) => void;
  onSendMessage: (content: string, modelId: string) => Promise<{ relevantMemories: RelevantMemory[] } | null>;
  onToggleMemoryPanel?: () => void;
  isMobile: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  models,
  isLoading,
  selectedModelId,
  selectedEmbeddingModelId,
  onModelChange,
  onEmbeddingModelChange,
  onSendMessage,
  onToggleMemoryPanel,
  isMobile
}) => {
  const [input, setInput] = useState('');
  const [relevantMemoriesMap, setRelevantMemoriesMap] = useState<Record<number, RelevantMemory[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutosizeTextarea();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const trimmedInput = input.trim();
    setInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Send message and get context
    const context = await onSendMessage(trimmedInput, selectedModelId);
    
    // Store relevant memories for this message
    if (context && context.relevantMemories) {
      // Find the message ID of the latest assistant message
      const latestAssistantMessage = [...messages]
        .reverse()
        .find(msg => msg.role === 'assistant');
      
      if (latestAssistantMessage) {
        setRelevantMemoriesMap(prev => ({
          ...prev,
          [latestAssistantMessage.id]: context.relevantMemories
        }));
      }
    }
  };
  
  // Group OpenAI and Anthropic models
  const openaiModels = models.filter(model => model.provider === 'openai');
  const anthropicModels = models.filter(model => model.provider === 'anthropic');
  
  // Display system message + all messages or just messages if there are any
  const displayMessages = messages.length > 0 
    ? messages 
    : [DEFAULT_SYSTEM_MESSAGE];
  
  return (
    <main className="flex-1 flex flex-col bg-white shadow-md">
      {/* Model Selection Bar */}
      <div className="bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-primary/80">Current Model</label>
            <div className="relative py-1.5 pl-3 pr-3 text-sm text-primary shadow-sm border border-primary/20 rounded-md bg-white/80 backdrop-blur-sm min-w-[200px]">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary/60 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>
                  {models.find(m => m.id === selectedModelId)?.name || selectedModelId}
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-primary/60 italic">Set in Settings</p>
          </div>
          
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-primary/80">Embedding Model</label>
            <div className="relative py-1.5 pl-3 pr-3 text-sm text-primary shadow-sm border border-primary/20 rounded-md bg-white/80 backdrop-blur-sm min-w-[200px]">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary/60 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <span>{selectedEmbeddingModelId}</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-primary/60 italic">Set in Settings</p>
          </div>
        </div>
        
        {isMobile && (
          <button 
            onClick={onToggleMemoryPanel}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 focus:outline-none transition-colors shadow-sm border border-primary/10"
            aria-label="Toggle Memory Panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Chat Messages Area */}
      <div className="chat-container flex flex-col h-[calc(100vh-64px)]">
        <div className="chat-messages flex-1 overflow-y-auto p-5 space-y-6 bg-gradient-to-b from-white to-primary/5">
          {displayMessages.map((message, i) => (
            <ChatMessage 
              key={message.id} 
              message={message}
              relevantMemories={relevantMemoriesMap[message.id]}
              isLast={i === displayMessages.length - 1}
            />
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center py-4 max-w-4xl mx-auto">
              <div className="flex items-center bg-white/80 backdrop-blur-sm px-5 py-3 rounded-xl border border-primary/10 shadow-sm text-primary/70">
                <div className="mr-3">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="text-sm font-medium">Generating response...</div>
              </div>
            </div>
          )}
          
          {/* Auto-scroll element */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input Area */}
        <div className="border-t border-primary/10 p-4 bg-gradient-to-b from-white to-primary/5">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3 max-w-4xl mx-auto">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                className="w-full pl-4 pr-10 py-3 border border-primary/20 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent resize-none transition-all"
                placeholder="Type your message here..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                disabled={isLoading}
              />
              {isMobile && (
                <button
                  type="button"
                  onClick={onToggleMemoryPanel}
                  className="absolute right-3 top-3 text-primary/60 hover:text-primary transition-colors"
                  title="View Memory Information"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 shadow-md disabled:opacity-50 disabled:pointer-events-none"
              disabled={isLoading || !input.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};
