import React, { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/chat-interface';
import { MemoryPanel } from '@/components/memory-panel';
import { SettingsModal } from '@/components/settings-modal';
import { useChatMessages, useSettings, useModels, useApiStatus, useMobile } from '@/lib/hooks';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { RelevantMemory, Settings } from '@/lib/types';

export default function Home() {
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_SETTINGS.defaultModelId);
  const [selectedEmbeddingModelId, setSelectedEmbeddingModelId] = useState(DEFAULT_SETTINGS.defaultEmbeddingModelId);
  const [relevantMemories, setRelevantMemories] = useState<RelevantMemory[]>([]);
  
  const isMobile = useMobile();
  const { messages, isLoading: isMessagesLoading, fetchMessages, sendMessage } = useChatMessages();
  const { settings, isLoading: isSettingsLoading, fetchSettings, updateSettings } = useSettings();
  const { models, isLoading: isModelsLoading, fetchModels } = useModels();
  const { status, isLoading: isStatusLoading, checkApiStatus } = useApiStatus();
  
  // Close memory panel on mobile initially
  useEffect(() => {
    if (isMobile) {
      setIsMemoryPanelOpen(false);
    }
  }, [isMobile]);
  
  // Fetch initial data
  useEffect(() => {
    fetchMessages();
    fetchSettings();
    fetchModels();
    checkApiStatus();
  }, [fetchMessages, fetchSettings, fetchModels, checkApiStatus]);
  
  // Update selected models when settings are loaded
  useEffect(() => {
    if (settings) {
      setSelectedModelId(settings.defaultModelId);
      setSelectedEmbeddingModelId(settings.defaultEmbeddingModelId);
    }
  }, [settings]);
  
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    
    // Also update default model in settings
    if (settings) {
      const updatedSettings: Partial<Settings> = { defaultModelId: modelId };
      updateSettings(updatedSettings);
    }
  };
  
  const handleEmbeddingModelChange = (modelId: string) => {
    setSelectedEmbeddingModelId(modelId);
    
    // Also update default embedding model in settings
    if (settings) {
      const updatedSettings: Partial<Settings> = { defaultEmbeddingModelId: modelId };
      updateSettings(updatedSettings);
    }
  };
  
  const handleSendMessage = async (content: string, modelId: string) => {
    const context = await sendMessage(content, modelId);
    
    if (context && context.relevantMemories) {
      setRelevantMemories(context.relevantMemories);
    }
    
    return context;
  };
  
  const handleToggleMemoryPanel = () => {
    setIsMemoryPanelOpen(!isMemoryPanelOpen);
  };
  
  const handleSaveSettings = async (updatedSettings: Partial<Settings>) => {
    return await updateSettings(updatedSettings);
  };
  
  const handleResetSettings = async () => {
    return await updateSettings(DEFAULT_SETTINGS);
  };
  
  // Calculate the total number of memories
  // In a real app, this would come from the backend
  const totalMemories = messages.length;
  
  // Get recent memories for the memory panel
  const recentMemories = messages.slice(-5).map((msg, i) => ({
    id: msg.id,
    content: msg.content,
    embedding: '', // Not needed for display
    type: msg.role === 'user' ? 'prompt' as const : 'response' as const,
    messageId: msg.id,
    timestamp: msg.timestamp,
    metadata: {}
  }));
  
  const isLoading = isMessagesLoading || isSettingsLoading || isModelsLoading;
  
  return (
    <div className="bg-neutral-light text-primary min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            <h1 className="text-xl font-bold">Structured Memory Engine</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-primary-light rounded-md px-2 py-1">
              <span className="text-xs text-neutral-light mr-2">API Status:</span>
              <span className="flex items-center">
                <span className={`h-2 w-2 rounded-full mr-1 ${
                  status?.status === 'ok' ? 'bg-success' : 'bg-error'
                }`}></span>
                <span className="text-xs">
                  {isStatusLoading 
                    ? 'Checking...' 
                    : status?.status === 'ok' 
                      ? 'Connected' 
                      : 'Error'}
                </span>
              </span>
            </div>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-white hover:text-accent focus:outline-none transition-colors"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        <ChatInterface 
          messages={messages}
          models={models}
          isLoading={isLoading}
          selectedModelId={selectedModelId}
          selectedEmbeddingModelId={selectedEmbeddingModelId}
          onModelChange={handleModelChange}
          onEmbeddingModelChange={handleEmbeddingModelChange}
          onSendMessage={handleSendMessage}
          onToggleMemoryPanel={handleToggleMemoryPanel}
          isMobile={isMobile}
        />
        
        <MemoryPanel 
          memories={recentMemories}
          isOpen={isMemoryPanelOpen}
          onClose={() => setIsMemoryPanelOpen(false)}
          isMobile={isMobile}
          totalMemories={totalMemories}
          relevantMemories={relevantMemories}
        />
      </div>
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        apiStatus={status}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
        isLoading={isSettingsLoading}
      />
    </div>
  );
}
