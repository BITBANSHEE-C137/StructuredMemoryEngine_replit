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
  
  // Scroll to bottom when messages change or component mounts
  useEffect(() => {
    if (messagesEndRef.current) {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }, [messages]);
  
  // Auto-scroll to input on initial load
  useEffect(() => {
    // Scroll to input area when component mounts
    const messageInput = document.querySelector('.message-input-area');
    if (messageInput) {
      messageInput.scrollIntoView({ behavior: 'auto' });
    }
  }, []);
  
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
      // We need to wait for the messages to update with the new assistant response
      setTimeout(() => {
        // Find the latest assistant message (should be the last one)
        const latestAssistantMessage = [...messages].reverse()
          .find(msg => msg.role === 'assistant');
        
        if (latestAssistantMessage) {
          console.log('Setting relevant memories for message ID:', latestAssistantMessage.id);
          setRelevantMemoriesMap(prev => ({
            ...prev,
            [latestAssistantMessage.id]: context.relevantMemories
          }));
        }
      }, 100); // Small delay to ensure messages are updated
    }
  };
  
  // Group OpenAI and Anthropic models
  const openaiModels = models.filter(model => model.provider === 'openai');
  const anthropicModels = models.filter(model => model.provider === 'anthropic');
  
  // Display system message + all messages or just messages if there are any
  // Messages come from the server/storage in chronological order (oldest first)
  // and we display them the same way (oldest at top, newest at bottom)
  const displayMessages = messages.length > 0 
    ? [...messages] // No modification needed - already in chronological order
    : [DEFAULT_SYSTEM_MESSAGE];
  
  return (
    <main className="flex-1 flex flex-col bg-white shadow-md h-full overflow-hidden">
      {/* Model Selection Bar - Fixed at top */}
      <div className="bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10 p-4 flex items-center justify-between sticky top-0 z-10">
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
      
      {/* Chat Messages Area - Scrollable middle section */}
      <div className="chat-container flex flex-col flex-1 overflow-hidden">
        <div className="chat-messages flex-1 overflow-y-auto p-4 bg-white">
          <div className="max-w-3xl mx-auto space-y-4 pb-20">
            {/* Welcome message if no messages */}
            {messages.length === 0 && (
              <div className="text-center my-12 py-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/90 to-primary mx-auto flex items-center justify-center text-white mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-primary/90 mb-2">Welcome to Structured Memory Engine</h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  I'm your context-aware assistant that remembers our conversations. Start by asking a question!
                </p>
              </div>
            )}
            
            {/* Display messages with oldest at top, newest at bottom */}
            {displayMessages.map((message, i) => (
              <ChatMessage 
                key={message.id} 
                message={message}
                isLast={i === displayMessages.length - 1}
              />
            ))}
            
            {/* Loading indicator at the bottom like ChatGPT */}
            {isLoading && (
              <div className="flex items-start max-w-3xl mx-auto">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/90 to-primary/80 shadow-md flex items-center justify-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="ml-4 max-w-3xl px-5 py-4 rounded-2xl bg-white border border-primary/10 rounded-tl-none shadow-sm">
                  <div className="flex items-center">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '100ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    </div>
                    <span className="ml-3 text-sm text-primary/60">Generating response...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Auto-scroll element */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input Area - Fixed at bottom */}
        <div className="message-input-area border-t border-primary/10 p-4 bg-gradient-to-b from-white to-primary/5 sticky bottom-0 z-10">
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
