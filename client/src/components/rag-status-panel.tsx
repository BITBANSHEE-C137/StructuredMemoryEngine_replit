import React from 'react';

interface RAGStatusPanelProps {
  contextSize: number;
  similarityThreshold: string | number;
  questionThresholdFactor: string | number;
  statementThresholdFactor: string | number;
  embeddingModel?: string;
  compact?: boolean;
}

export const RAGStatusPanel: React.FC<RAGStatusPanelProps> = ({
  contextSize,
  similarityThreshold,
  questionThresholdFactor,
  statementThresholdFactor,
  embeddingModel = 'text-embedding-3-small',
  compact = false
}) => {
  // Convert string values to numbers if needed
  const thresholdValue = typeof similarityThreshold === 'string' 
    ? parseFloat(similarityThreshold) 
    : similarityThreshold;
    
  const questionFactor = typeof questionThresholdFactor === 'string'
    ? parseFloat(questionThresholdFactor)
    : questionThresholdFactor;
    
  const statementFactor = typeof statementThresholdFactor === 'string'
    ? parseFloat(statementThresholdFactor)
    : statementThresholdFactor;
    
  // Format embedding model name
  const formattedModelName = embeddingModel.includes('embedding') 
    ? embeddingModel.replace('text-embedding-', '')
    : embeddingModel;
    
  return (
    <div className="w-full">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-sm font-semibold text-blue-800">RAG System Status</h3>
        </div>
        <span className="text-xs font-medium text-white bg-green-600 px-2 py-0.5 rounded-full">Active</span>
      </div>
      
      {/* Status Cards */}
      <div className="flex gap-2 flex-wrap mb-4">
        <div className="bg-white/50 border border-blue-200 rounded-lg py-1.5 px-2 flex-1 flex flex-col items-center">
          <span className="text-xs text-blue-800">Context Size</span>
          <span className="text-sm font-medium text-blue-900">{contextSize}</span>
        </div>
        
        <div className="bg-white/50 border border-blue-200 rounded-lg py-1.5 px-2 flex-1 flex flex-col items-center">
          <span className="text-xs text-blue-800">Threshold</span>
          <span className="text-sm font-medium text-blue-900">{thresholdValue.toFixed(2)}</span>
        </div>
        
        <div className="bg-white/50 border border-blue-200 rounded-lg py-1.5 px-2 flex-1 flex flex-col items-center">
          <span className="text-xs text-blue-800">Model</span>
          <span className="text-sm font-medium text-blue-900 truncate max-w-full">
            {formattedModelName}
          </span>
        </div>
      </div>
      
      {!compact && (
        <>
          {/* Control Sliders */}
          <div className="space-y-4">
            <div>
              <label htmlFor="context-retrieval" className="flex items-center justify-between text-sm mb-1">
                <span className="text-primary font-medium">Context Window Size</span>
                <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">{contextSize}</span>
              </label>
              <input 
                id="context-retrieval" 
                type="range" 
                min="1" 
                max="10" 
                value={contextSize}
                readOnly
                className="w-full h-2 bg-neutral rounded-lg appearance-none accent-primary border border-primary/20" 
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
                <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                  {thresholdValue.toFixed(2)} ({(thresholdValue * 100).toFixed(0)}%)
                </span>
              </label>
              <input 
                id="similarity-threshold" 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={thresholdValue}
                readOnly
                className="w-full h-2 bg-neutral rounded-lg appearance-none accent-primary border border-primary/20" 
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
            <div className="mt-2">
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
                {/* Question Threshold Factor Display */}
                <div>
                  <label htmlFor="question-threshold" className="flex items-center justify-between text-sm mb-1">
                    <span className="text-primary font-medium">Question Mode</span>
                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                      {questionFactor.toFixed(2)}
                    </span>
                  </label>
                  <input 
                    id="question-threshold" 
                    type="range" 
                    min="0.55" 
                    max="0.85" 
                    step="0.05" 
                    value={questionFactor}
                    readOnly
                    className="w-full h-2 bg-neutral rounded-lg appearance-none accent-blue-500 border border-blue-200" 
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
                
                {/* Statement Threshold Factor Display */}
                <div>
                  <label htmlFor="statement-threshold" className="flex items-center justify-between text-sm mb-1">
                    <span className="text-primary font-medium">Statement Mode</span>
                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                      {statementFactor.toFixed(2)}
                    </span>
                  </label>
                  <input 
                    id="statement-threshold" 
                    type="range" 
                    min="0.75" 
                    max="0.95" 
                    step="0.05" 
                    value={statementFactor}
                    readOnly
                    className="w-full h-2 bg-neutral rounded-lg appearance-none accent-purple-500 border border-purple-200" 
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
          </div>
        </>
      )}
    </div>
  );
};