import React from 'react';
import { Memory, RelevantMemory } from '@/lib/types';
import { format } from 'date-fns';

interface MemoryPanelProps {
  memories: Memory[];
  isOpen: boolean;
  onClose?: () => void;
  isMobile: boolean;
  totalMemories: number;
  relevantMemories?: RelevantMemory[];
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  memories,
  isOpen,
  onClose,
  isMobile,
  totalMemories = 0,
  relevantMemories = []
}) => {
  if (!isOpen) return null;

  // Calculate total tokens (mock data for now)
  const totalTokens = totalMemories * 500; // Rough estimate
  
  return (
    <aside 
      className={`${isMobile 
        ? 'fixed inset-0 z-40 bg-neutral-light overflow-y-auto' 
        : 'w-full md:w-80 lg:w-96 bg-neutral-light border-l border-neutral-dark overflow-y-auto'}`}
    >
      {isMobile && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-primary-light hover:text-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      <div className="p-4">
        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Memory System
        </h2>
        
        {/* Memory Stats */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h3 className="text-sm font-medium text-primary mb-3">Memory Stats</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-neutral p-2 rounded">
              <div className="text-secondary font-medium">Total Memories</div>
              <div className="text-primary text-lg font-semibold">{totalMemories}</div>
            </div>
            <div className="bg-neutral p-2 rounded">
              <div className="text-secondary font-medium">Tokens Used</div>
              <div className="text-primary text-lg font-semibold">
                {totalTokens > 1000 
                  ? `${(totalTokens / 1000).toFixed(1)}k` 
                  : totalTokens}
              </div>
            </div>
            <div className="bg-neutral p-2 rounded">
              <div className="text-secondary font-medium">Vector Dimension</div>
              <div className="text-primary text-lg font-semibold">1536</div>
            </div>
            <div className="bg-neutral p-2 rounded">
              <div className="text-secondary font-medium">Database</div>
              <div className="text-primary text-lg font-semibold">PGVector</div>
            </div>
          </div>
        </div>
        
        {/* Embedding Visualization */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h3 className="text-sm font-medium text-primary mb-2">Memory Retrieval Visualization</h3>
          <div className="text-xs text-primary-light mb-3">
            Showing embedding similarity for current context
          </div>
          <div className="rounded-lg overflow-hidden bg-neutral h-48 p-4 relative">
            <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <circle cx="100" cy="75" r="5" fill="#5E81AC" className="memory-pulse" />
              {relevantMemories.map((memory, i) => {
                // Position circles based on similarity (higher = closer)
                const distance = 40 * (1 - Math.min(memory.similarity, 0.99));
                const angle = (i / relevantMemories.length) * Math.PI * 2;
                const x = 100 + distance * Math.cos(angle);
                const y = 75 + distance * Math.sin(angle);
                
                return (
                  <React.Fragment key={memory.id}>
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={3} 
                      fill={memory.similarity > 0.8 ? "#81A1C1" : "#8FBCBB"} 
                    />
                    <line 
                      x1="100" 
                      y1="75" 
                      x2={x} 
                      y2={y} 
                      stroke="#5E81AC" 
                      strokeWidth="1" 
                      strokeOpacity={memory.similarity} 
                    />
                  </React.Fragment>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-xs font-mono opacity-70 z-10 bg-white bg-opacity-70 px-2 py-1 rounded">
                Current query vector
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Memories */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-primary mb-2">Recent Memories</h3>
          <div className="text-xs text-primary-light mb-3">
            Most recently stored conversation fragments
          </div>
          
          {memories.slice(0, 3).map((memory, index) => (
            <div key={memory.id} className="border border-neutral-dark rounded-md p-3 mb-2 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-secondary">Memory #{memory.id}</span>
                <span className="text-primary-light">
                  {memory.timestamp 
                    ? format(new Date(memory.timestamp), 'MM/dd HH:mm') 
                    : 'Just now'}
                </span>
              </div>
              <p className="text-primary-light mb-1 line-clamp-2">{memory.content}</p>
              <div className="flex items-center text-xs text-primary-light">
                <span className="bg-neutral rounded px-1 py-0.5 text-xxs">
                  {memory.type === 'prompt' ? 'USER' : 'AI'}
                </span>
                {memory.similarity && (
                  <span className="ml-2">Similarity: {memory.similarity.toFixed(2)}</span>
                )}
              </div>
            </div>
          ))}
          
          {memories.length > 3 && (
            <button className="mt-3 w-full text-secondary hover:text-secondary-dark text-xs font-medium flex items-center justify-center py-2 border border-dashed border-secondary rounded transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
              View More Memories
            </button>
          )}
          
          {memories.length === 0 && (
            <div className="text-center py-4 text-primary-light text-sm">
              No memories stored yet. Start a conversation to create memories.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
