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
  onModelChange: (modelId: string) => void;
  onSendMessage: (content: string, modelId: string) => Promise<{ relevantMemories: RelevantMemory[] } | null>;
  onToggleMemoryPanel?: () => void;
  isMobile: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  models,
  isLoading,
  selectedModelId,
  onModelChange,
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
      <div className="bg-neutral p-4 border-b border-neutral-dark flex items-center justify-between">
        <div className="flex items-center">
          <label htmlFor="model-select" className="mr-2 text-sm font-medium">AI Model:</label>
          <div className="relative">
            <select 
              id="model-select" 
              className="appearance-none bg-white border border-neutral-dark rounded-md py-1 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              value={selectedModelId}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={isLoading}
            >
              {openaiModels.length > 0 && (
                <optgroup label="OpenAI">
                  {openaiModels.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </optgroup>
              )}
              {anthropicModels.length > 0 && (
                <optgroup label="Anthropic">
                  {anthropicModels.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="flex items-center">
          <span className="text-xs mr-2">Embedding Model:</span>
          <span className="text-xs font-medium bg-secondary bg-opacity-10 text-secondary px-2 py-1 rounded">ada-002</span>
        </div>
      </div>
      
      {/* Chat Messages Area */}
      <div className="chat-container flex flex-col h-[calc(100vh-64px)]">
        <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-4 bg-pattern">
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
            <div className="flex justify-center py-2">
              <div className="animate-pulse flex space-x-2">
                <div className="w-2 h-2 bg-secondary rounded-full"></div>
                <div className="w-2 h-2 bg-secondary rounded-full"></div>
                <div className="w-2 h-2 bg-secondary rounded-full"></div>
              </div>
            </div>
          )}
          
          {/* Auto-scroll element */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input Area */}
        <div className="border-t border-neutral-dark p-4 bg-white">
          <form onSubmit={handleSubmit} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                className="w-full pl-3 pr-10 py-3 border border-neutral-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
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
                  className="absolute right-3 top-3 text-neutral-dark hover:text-secondary transition-colors"
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
              className="bg-secondary hover:bg-secondary-dark text-white rounded-lg px-4 py-3 font-medium flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
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
