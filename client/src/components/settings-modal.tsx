import React, { useState, useEffect } from 'react';
import { Settings, Model, ApiStatus } from '@/lib/types';
import { DEFAULT_SETTINGS, API_ROUTES, ERROR_MESSAGES, DEFAULT_SYSTEM_MESSAGE } from '@/lib/constants';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useChatMessages } from '@/lib/hooks';
import { PineconeSettingsModal } from './pinecone-settings-modal';
import { RAGStatusPanel } from './rag-status-panel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings | null;
  apiStatus: ApiStatus | null;
  onSave: (settings: Partial<Settings>) => Promise<Settings | null>;
  onReset: () => Promise<Settings | null>;
  isLoading: boolean;
  models?: Model[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  apiStatus,
  onSave,
  onReset,
  isLoading,
  models = []
}) => {
  const [contextSize, setContextSize] = useState(DEFAULT_SETTINGS.contextSize);
  const [similarityThreshold, setSimilarityThreshold] = useState(DEFAULT_SETTINGS.similarityThreshold);
  const [questionThresholdFactor, setQuestionThresholdFactor] = useState(settings?.questionThresholdFactor || "0.7");
  const [statementThresholdFactor, setStatementThresholdFactor] = useState(settings?.statementThresholdFactor || "0.85");
  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_SETTINGS.defaultModelId);
  const [defaultEmbeddingModelId, setDefaultEmbeddingModelId] = useState(DEFAULT_SETTINGS.defaultEmbeddingModelId);
  const [clearingMemories, setClearingMemories] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isPineconeSettingsOpen, setIsPineconeSettingsOpen] = useState(false);
  const { toast } = useToast();
  
  // Get chat message functions
  const { clearMessages } = useChatMessages();
  
  // Sync state with props when settings change
  useEffect(() => {
    if (settings) {
      setContextSize(settings.contextSize);
      setSimilarityThreshold(settings.similarityThreshold);
      setQuestionThresholdFactor(settings.questionThresholdFactor || "0.7");
      setStatementThresholdFactor(settings.statementThresholdFactor || "0.85");
      setDefaultModelId(settings.defaultModelId || DEFAULT_SETTINGS.defaultModelId);
      setDefaultEmbeddingModelId(settings.defaultEmbeddingModelId || DEFAULT_SETTINGS.defaultEmbeddingModelId);
    }
  }, [settings]);
  
  if (!isOpen) return null;

  const handleClearMemories = async () => {
    try {
      setClearingMemories(true);
      
      const response = await apiRequest(
        '/api/memories/clear',
        {
          method: 'POST'
        }
      );
      
      // Directly invalidate the queries
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memories'] });
      
      // Also clear the messages from the chat state
      clearMessages();
      
      toast({
        title: "Memories and Chat Cleared",
        description: `Successfully cleared ${response.count || 0} memories`,
        variant: "default"
      });
      
      setShowConfirmClear(false);
    } catch (error) {
      toast({
        title: "Error",
        description: ERROR_MESSAGES.CLEAR_MEMORIES,
        variant: "destructive"
      });
      console.error("Error clearing memories:", error);
    } finally {
      setClearingMemories(false);
    }
  };
  
  const handleSave = async () => {
    const updated = await onSave({
      contextSize,
      similarityThreshold,
      questionThresholdFactor,
      statementThresholdFactor,
      defaultModelId,
      defaultEmbeddingModelId
    });
    
    if (updated) {
      onClose();
    }
  };
  
  const handleReset = async () => {
    const reset = await onReset();
    if (reset) {
      setContextSize(reset.contextSize);
      setSimilarityThreshold(reset.similarityThreshold);
      setQuestionThresholdFactor(reset.questionThresholdFactor || "0.7");
      setStatementThresholdFactor(reset.statementThresholdFactor || "0.85");
      setDefaultModelId(reset.defaultModelId || DEFAULT_SETTINGS.defaultModelId);
      setDefaultEmbeddingModelId(reset.defaultEmbeddingModelId || DEFAULT_SETTINGS.defaultEmbeddingModelId);
    }
  };
  
  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
          <div className="p-4 border-b border-neutral-dark flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Settings</h2>
            <button 
              onClick={onClose}
              className="text-primary-light hover:text-primary transition-colors"
              disabled={isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-4 h-[70vh] overflow-y-auto">
            <h3 className="text-sm font-medium text-primary mb-3">API Configuration</h3>
            
            {/* OpenAI Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium">OpenAI</span>
                </div>
                <div className="flex items-center">
                  <span 
                    className={`h-2 w-2 rounded-full mr-1 ${
                      apiStatus?.providers.openai === 'connected' ? 'bg-success' : 'bg-error'
                    }`}
                  ></span>
                  <span 
                    className={`text-xs ${
                      apiStatus?.providers.openai === 'connected' ? 'text-success' : 'text-error'
                    }`}
                  >
                    {apiStatus?.providers.openai === 'connected' ? 'Connected' : 'Error'}
                  </span>
                </div>
              </div>
              
              <div className="bg-neutral p-3 rounded text-xs">
                <div className="mb-2">
                  <div className="flex justify-between text-primary-light mb-1">
                    <span>API Key Status</span>
                    <span className={`font-medium ${
                      apiStatus?.providers.openai === 'connected' ? 'text-success' : 'text-error'
                    }`}>
                      {apiStatus?.providers.openai === 'connected' ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                  <div className="flex justify-between text-primary-light">
                    <span>Models Available</span>
                    <span className="font-medium">
                      {apiStatus?.providers.openai === 'connected' 
                        ? models.filter(m => m.provider === 'openai').length 
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Anthropic Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium">Anthropic</span>
                </div>
                <div className="flex items-center">
                  <span 
                    className={`h-2 w-2 rounded-full mr-1 ${
                      apiStatus?.providers.anthropic === 'connected' ? 'bg-success' : 'bg-error'
                    }`}
                  ></span>
                  <span 
                    className={`text-xs ${
                      apiStatus?.providers.anthropic === 'connected' ? 'text-success' : 'text-error'
                    }`}
                  >
                    {apiStatus?.providers.anthropic === 'connected' ? 'Connected' : 'Error'}
                  </span>
                </div>
              </div>
              
              <div className="bg-neutral p-3 rounded text-xs">
                <div className="mb-2">
                  <div className="flex justify-between text-primary-light mb-1">
                    <span>API Key Status</span>
                    <span className={`font-medium ${
                      apiStatus?.providers.anthropic === 'connected' ? 'text-success' : 'text-error'
                    }`}>
                      {apiStatus?.providers.anthropic === 'connected' ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                  <div className="flex justify-between text-primary-light">
                    <span>Models Available</span>
                    <span className="font-medium">
                      {apiStatus?.providers.anthropic === 'connected'
                        ? models.filter(m => m.provider === 'anthropic').length
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Memory Settings */}
            <h3 className="text-sm font-medium text-primary mb-3 mt-6">Memory Settings</h3>
            
            {/* RAG System Status Indicator */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg shadow-sm mb-4">
              <RAGStatusPanel 
                contextSize={contextSize}
                similarityThreshold={similarityThreshold}
                questionThresholdFactor={questionThresholdFactor}
                statementThresholdFactor={statementThresholdFactor}
                embeddingModel={settings?.defaultEmbeddingModelId || 'text-embedding-3-small'}
                compact={true}
              />
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="context-retrieval" className="flex items-center justify-between text-sm mb-1">
                  <span className="text-primary font-medium">Context Window Size</span>
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium" id="context-value">{contextSize}</span>
                </label>
                <input 
                  id="context-retrieval" 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={contextSize}
                  onChange={(e) => setContextSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-neutral rounded-lg appearance-none cursor-pointer accent-primary border border-primary/20" 
                  style={{ 
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                />
                <div className="flex justify-between text-xs text-primary mt-1">
                  <span>Fewer, More Relevant</span>
                  <span>More, Less Relevant</span>
                </div>
              </div>
              
              <div>
                <label htmlFor="similarity-threshold" className="flex items-center justify-between text-sm mb-1">
                  <span className="text-primary font-medium">Similarity Threshold</span>
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium" id="similarity-value">{parseFloat(similarityThreshold).toFixed(2)} ({(parseFloat(similarityThreshold) * 100).toFixed(0)}%)</span>
                </label>
                <input 
                  id="similarity-threshold" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={parseFloat(similarityThreshold)}
                  onChange={(e) => setSimilarityThreshold(e.target.value)}
                  className="w-full h-2 bg-neutral rounded-lg appearance-none cursor-pointer accent-primary border border-primary/20" 
                  style={{ 
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                />
                <div className="flex justify-between text-xs text-primary mt-1">
                  <span>Lower Precision</span>
                  <span>Higher Precision</span>
                </div>
              </div>
              
              {/* Smart Retrieval Controls */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-primary">Smart Retrieval Controls</h4>
                  <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">New</div>
                </div>
                
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                  <p className="text-xs text-blue-800 mb-2">
                    The system automatically detects questions vs. statements and adjusts memory retrieval accordingly:
                  </p>
                  <ul className="text-xs text-blue-800 list-disc list-inside space-y-1">
                    <li>Questions get broader results to find potential answers</li>
                    <li>Statements get more precise matching for accuracy</li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  {/* Question Threshold Factor - Simplified */}
                  <div>
                    <label htmlFor="question-threshold" className="flex items-center justify-between text-sm mb-1">
                      <span className="text-primary font-medium">Question Mode</span>
                      <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                        {parseFloat(questionThresholdFactor).toFixed(2)}
                      </span>
                    </label>
                    <input 
                      id="question-threshold" 
                      type="range" 
                      min="0.55" 
                      max="0.85" 
                      step="0.05" 
                      value={parseFloat(questionThresholdFactor)}
                      onChange={(e) => setQuestionThresholdFactor(e.target.value)}
                      className="w-full h-2 bg-neutral rounded-lg appearance-none cursor-pointer accent-blue-500 border border-blue-200" 
                      style={{ 
                        WebkitAppearance: 'none',
                        appearance: 'none',
                      }}
                    />
                    <div className="flex justify-between text-xs text-blue-700 mt-1">
                      <span>More Results</span>
                      <span>Higher Accuracy</span>
                    </div>
                  </div>
                  
                  {/* Statement Threshold Factor - Simplified */}
                  <div>
                    <label htmlFor="statement-threshold" className="flex items-center justify-between text-sm mb-1">
                      <span className="text-primary font-medium">Statement Mode</span>
                      <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                        {parseFloat(statementThresholdFactor).toFixed(2)}
                      </span>
                    </label>
                    <input 
                      id="statement-threshold" 
                      type="range" 
                      min="0.75" 
                      max="0.95" 
                      step="0.05" 
                      value={parseFloat(statementThresholdFactor)}
                      onChange={(e) => setStatementThresholdFactor(e.target.value)}
                      className="w-full h-2 bg-neutral rounded-lg appearance-none cursor-pointer accent-purple-500 border border-purple-200" 
                      style={{ 
                        WebkitAppearance: 'none',
                        appearance: 'none',
                      }}
                    />
                    <div className="flex justify-between text-xs text-purple-700 mt-1">
                      <span>More Results</span>
                      <span>Higher Accuracy</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="default-model" className="text-sm mb-1 block text-primary font-medium">
                  Default Chat Model
                </label>
                <select
                  id="default-model"
                  value={defaultModelId}
                  onChange={(e) => setDefaultModelId(e.target.value)}
                  className="w-full p-2 border border-primary/20 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {models.length > 0 ? (
                    // Group models by provider
                    <>
                      <optgroup label="OpenAI Models">
                        {models
                          .filter(model => model.provider === 'openai' && !model.id.includes('embedding'))
                          .map(model => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))
                        }
                      </optgroup>
                      <optgroup label="Anthropic Models">
                        {models
                          .filter(model => model.provider === 'anthropic')
                          .map(model => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))
                        }
                      </optgroup>
                    </>
                  ) : (
                    <>
                      <option value="gpt-4o">GPT-4o (OpenAI)</option>
                      <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Anthropic)</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-primary mt-1">
                  Default model used for chat responses
                </p>
              </div>
              
              <div>
                <label htmlFor="embedding-model" className="text-sm mb-1 block text-primary font-medium">
                  Embedding Model (Static Configuration)
                </label>
                <div
                  id="embedding-model"
                  className="w-full p-2 border border-primary/20 bg-neutral/50 rounded text-sm"
                >
                  {defaultEmbeddingModelId || 'text-embedding-3-small'} (OpenAI)
                </div>
                <p className="text-xs text-primary mt-1">
                  Model used for embedding queries and memories for vector retrieval
                </p>
              </div>
              
              <div className="mt-6 border-t pt-4 border-neutral-light">
                <h4 className="text-sm font-medium text-primary mb-2">Memory Management</h4>
                
                <div className="space-y-3">
                  {/* Pinecone settings button */}
                  <button
                    type="button"
                    onClick={() => setIsPineconeSettingsOpen(true)}
                    className="w-full py-2 px-4 border border-secondary text-secondary text-sm rounded hover:bg-secondary/5 transition-colors flex justify-between items-center"
                  >
                    <span>Configure Pinecone Integration</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-database ml-2">
                      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                    </svg>
                  </button>
                  
                  {/* Clear memories button or confirmation */}
                  {!showConfirmClear ? (
                    <button
                      type="button"
                      onClick={() => setShowConfirmClear(true)}
                      className="w-full py-2 px-4 border border-error text-error text-sm rounded hover:bg-error/5 transition-colors"
                    >
                      Clear All Memories
                    </button>
                  ) : (
                    <div className="bg-error/5 border border-error rounded p-3">
                      <p className="text-sm text-primary mb-3">
                        Are you sure you want to clear all memories? This action cannot be undone.
                      </p>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowConfirmClear(false)}
                          className="flex-1 py-1.5 border border-neutral-dark text-primary-light text-sm rounded hover:bg-neutral transition-colors"
                          disabled={clearingMemories}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleClearMemories}
                          className="flex-1 py-1.5 bg-error text-white text-sm rounded hover:bg-error-dark transition-colors flex items-center justify-center"
                          disabled={clearingMemories}
                        >
                          {clearingMemories ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Clearing...
                            </>
                          ) : (
                            "Confirm Clear"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-neutral-dark flex justify-end space-x-3">
            <button 
              onClick={handleReset}
              className="text-sm px-4 py-2 border border-neutral-dark text-primary-light hover:bg-neutral rounded focus:outline-none focus:ring-2 focus:ring-secondary transition-colors"
              disabled={isLoading}
            >
              Reset to Default
            </button>
            <button 
              onClick={handleSave}
              className="text-sm px-4 py-2 bg-secondary hover:bg-secondary-dark text-white rounded focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Pinecone Settings Modal */}
      <PineconeSettingsModal 
        isOpen={isPineconeSettingsOpen}
        onClose={() => setIsPineconeSettingsOpen(false)}
      />
    </>
  );
};