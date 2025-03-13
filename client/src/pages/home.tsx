import React, { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/chat-interface';
import { MemoryPanel } from '@/components/memory-panel';
import { SettingsModal } from '@/components/settings-modal';
import { useChatMessages, useSettings, useModels, useApiStatus, useMobile } from '@/lib/hooks';
import { DEFAULT_SETTINGS, API_ROUTES } from '@/lib/constants';
import { RelevantMemory, Settings } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

// User menu with logout button
function UserMenuWithLogout() {
  const { user } = useAuth();
  
  return (
    <div className="flex items-center space-x-2">
      {user?.profileImage && (
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30">
          <img src={user.profileImage} alt={user.name || 'User'} className="w-full h-full object-cover" />
        </div>
      )}
      
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">
          {user?.name || 'User'}
        </span>
      </div>
      
      <Button 
        variant="outline" 
        size="sm"
        className="ml-2 bg-white/10 text-white hover:bg-white/20 border-white/20"
        onClick={() => window.location.href = API_ROUTES.AUTH.LOGOUT}
      >
        Logout
      </Button>
    </div>
  );
}

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
    <div className="bg-neutral-light text-primary h-full flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary/90 to-primary shadow-lg border-b border-primary/20 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative h-12 w-12 flex items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 shadow-app">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="h-10 w-10">
                <defs>
                  <linearGradient id="logo-gradient-primary" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                  </linearGradient>
                  <linearGradient id="logo-gradient-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                
                {/* Base circle */}
                <circle cx="32" cy="32" r="28" fill="none" stroke="url(#logo-gradient-primary)" strokeWidth="2" opacity="0.8" />
                
                {/* Neural network connections */}
                <g stroke="url(#logo-gradient-primary)" strokeWidth="1.5" opacity="0.7">
                  <path d="M20,20 L32,12 L44,20" />
                  <path d="M20,20 L20,32 L20,44" />
                  <path d="M20,44 L32,52 L44,44" />
                  <path d="M44,20 L44,32 L44,44" />
                  <path d="M20,20 L32,32 L44,20" />
                  <path d="M20,44 L32,32 L44,44" />
                  <path d="M32,12 L32,32 L32,52" />
                </g>
                
                {/* Nodes */}
                <circle cx="32" cy="12" r="4" fill="url(#logo-gradient-primary)" filter="url(#glow)" />
                <circle cx="20" cy="20" r="4" fill="url(#logo-gradient-primary)" filter="url(#glow)" />
                <circle cx="44" cy="20" r="4" fill="url(#logo-gradient-primary)" filter="url(#glow)" />
                <circle cx="32" cy="32" r="6" fill="url(#logo-gradient-accent)" filter="url(#glow)" />
                <circle cx="20" cy="44" r="4" fill="url(#logo-gradient-primary)" filter="url(#glow)" />
                <circle cx="44" cy="44" r="4" fill="url(#logo-gradient-primary)" filter="url(#glow)" />
                <circle cx="32" cy="52" r="4" fill="url(#logo-gradient-primary)" filter="url(#glow)" />
              </svg>
              
              <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full border-2 border-white/80 shadow-lg flex items-center justify-center">
                <span className="animate-pulse">
                  <span className="block h-2 w-2 rounded-full bg-white shadow-inner"></span>
                </span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                Structured Memory Engine
              </h1>
              <div className="flex items-center">
                <p className="text-xs text-white/60 font-medium tracking-wide">Context-Aware RAG System</p>
                <span className="inline-flex ml-2 items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-app-info/40 text-white/90 ring-1 ring-inset ring-white/20">v1.0</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
              <span className="text-xs text-white/70 mr-2">API Status:</span>
              <span className="flex items-center">
                <span className={`h-2.5 w-2.5 rounded-full mr-1.5 ${
                  status?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}></span>
                <span className="text-xs font-medium text-white">
                  {isStatusLoading 
                    ? 'Checking...' 
                    : status?.status === 'ok' 
                      ? 'Connected' 
                      : 'Error'}
                </span>
              </span>
            </div>
            
            <UserMenuWithLogout />
            
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center text-white p-2 rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all transform hover:scale-105 active:scale-95 shadow-app-sm backdrop-blur-sm border border-white/20"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
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
        models={models}
      />
    </div>
  );
}
