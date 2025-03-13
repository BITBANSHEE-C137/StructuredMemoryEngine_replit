import React, { useState, useEffect } from 'react';
import { Settings, Model, ApiStatus } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings | null;
  apiStatus: ApiStatus | null;
  onSave: (settings: Partial<Settings>) => Promise<Settings | null>;
  onReset: () => Promise<Settings | null>;
  isLoading: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  apiStatus,
  onSave,
  onReset,
  isLoading
}) => {
  const [contextSize, setContextSize] = useState(DEFAULT_SETTINGS.contextSize);
  const [similarityThreshold, setSimilarityThreshold] = useState(DEFAULT_SETTINGS.similarityThreshold);
  const [autoClearMemories, setAutoClearMemories] = useState(DEFAULT_SETTINGS.autoClearMemories);
  
  // Sync state with props when settings change
  useEffect(() => {
    if (settings) {
      setContextSize(settings.contextSize);
      setSimilarityThreshold(settings.similarityThreshold);
      setAutoClearMemories(settings.autoClearMemories);
    }
  }, [settings]);
  
  if (!isOpen) return null;
  
  const handleSave = async () => {
    const updated = await onSave({
      contextSize,
      similarityThreshold,
      autoClearMemories
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
      setAutoClearMemories(reset.autoClearMemories);
    }
  };
  
  return (
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
        
        <div className="p-4">
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
                    {apiStatus?.providers.openai === 'connected' ? '3' : '0'}
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
                    {apiStatus?.providers.anthropic === 'connected' ? '2' : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Memory Settings */}
          <h3 className="text-sm font-medium text-primary mb-3 mt-6">Memory Settings</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="context-retrieval" className="flex items-center justify-between text-sm mb-1">
                <span>Context Window Size</span>
                <span className="text-secondary font-medium" id="context-value">{contextSize}</span>
              </label>
              <input 
                id="context-retrieval" 
                type="range" 
                min="1" 
                max="10" 
                value={contextSize}
                onChange={(e) => setContextSize(parseInt(e.target.value))}
                className="w-full h-2 bg-neutral rounded-lg appearance-none cursor-pointer" 
              />
              <div className="flex justify-between text-xs text-primary-light mt-1">
                <span>Fewer, More Relevant</span>
                <span>More, Less Relevant</span>
              </div>
            </div>
            
            <div>
              <label htmlFor="similarity-threshold" className="flex items-center justify-between text-sm mb-1">
                <span>Similarity Threshold</span>
                <span className="text-secondary font-medium" id="similarity-value">{similarityThreshold}</span>
              </label>
              <input 
                id="similarity-threshold" 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={parseFloat(similarityThreshold)}
                onChange={(e) => setSimilarityThreshold(e.target.value)}
                className="w-full h-2 bg-neutral rounded-lg appearance-none cursor-pointer" 
              />
              <div className="flex justify-between text-xs text-primary-light mt-1">
                <span>Lower Precision</span>
                <span>Higher Precision</span>
              </div>
            </div>
            
            <div className="flex items-center">
              <input 
                id="auto-clear" 
                type="checkbox" 
                checked={autoClearMemories}
                onChange={(e) => setAutoClearMemories(e.target.checked)}
                className="h-4 w-4 text-secondary focus:ring-secondary border-neutral-dark rounded"
              />
              <label htmlFor="auto-clear" className="ml-2 text-sm">Auto-clear memories after session</label>
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
  );
};
