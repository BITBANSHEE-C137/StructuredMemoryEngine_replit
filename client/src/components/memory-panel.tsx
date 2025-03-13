import React, { useState, useEffect } from 'react';
import { Memory, RelevantMemory } from '@/lib/types';
import { format } from 'date-fns';
import { API_ROUTES } from '@/lib/constants';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { usePineconeStats } from '@/hooks/usePineconeStats';
import { usePineconeSettings } from '@/hooks/usePineconeSettings';
import { Loader2 } from 'lucide-react';

interface MemoryPanelProps {
  memories: Memory[];
  isOpen: boolean;
  onClose?: () => void;
  isMobile: boolean;
  totalMemories: number;
  relevantMemories?: RelevantMemory[];
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  memories: initialMemories,
  isOpen,
  onClose,
  isMobile,
  totalMemories = 0,
  relevantMemories = []
}) => {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(totalMemories || 0);
  const [loading, setLoading] = useState(false);
  
  // Fetch Pinecone stats
  const { stats: pineconeStats, isLoading: loadingPinecone } = usePineconeStats();
  
  // Fetch Pinecone operation status
  const { currentOperation, operationIndex, operationNamespace } = usePineconeSettings();

  // Initialize with total memories from props
  useEffect(() => {
    if (totalMemories > 0) {
      setTotal(totalMemories);
    }
  }, [totalMemories]);

  // Fetch memories when panel is open
  useEffect(() => {
    if (isOpen) {
      fetchMemories(page, pageSize);
    }
  }, [isOpen, page, pageSize]);

  const fetchMemories = async (pageNum: number, pageSizeNum: number) => {
    if (loading) return;
    
    setLoading(true);
    try {
      // apiRequest already parses the JSON for us
      const data = await apiRequest(
        `${API_ROUTES.MEMORIES}?page=${pageNum}&pageSize=${pageSizeNum}`
      );
      if (data && typeof data === 'object' && 'memories' in data && 'total' in data) {
        setMemories(data.memories);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (page * pageSize < total) {
      setPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  // We're not calculating token usage as it requires a precise tokenization algorithm
  // that matches the one used by the embedding model
  
  return (
    <aside 
      className={`${isMobile 
        ? 'fixed inset-0 z-40 bg-gradient-to-br from-white to-primary/5 overflow-y-auto' 
        : 'w-full md:w-80 lg:w-96 bg-gradient-to-br from-white to-primary/5 border-l border-primary/10 overflow-y-auto shadow-lg'}`}
    >
      {isMobile && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-primary/60 hover:text-primary transition-colors bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm"
          aria-label="Close memory panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      <div className="p-5">
        <h2 className="text-xl font-bold text-primary mb-5 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">Memory System</span>
        </h2>
        
        {/* Memory Stats */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-5 mb-5 border border-primary/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-primary flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Memory Stats
            </h3>
            
            {/* Status indicator */}
            {currentOperation !== 'none' && (
              <div className="flex items-center bg-rose-50 text-rose-600 text-xs px-2 py-1 rounded-full border border-rose-200">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                <span>{currentOperation === 'sync' ? 'Syncing...' : 'Hydrating...'}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 text-xs">
            {/* Local PGVector Stats */}
            <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 col-span-1">
              <div className="text-primary/70 font-medium mb-1 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Local Storage (PGVector)
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="text-primary font-medium">
                  <span className="text-lg font-bold">{total}</span> 
                  <span className="text-xs ml-1 text-primary/70">memories</span>
                </div>
                <div className={`text-xs ${loading ? 'text-primary/70 bg-primary/10' : 'text-emerald-600 bg-emerald-100'} px-2 py-1 rounded-full`}>
                  {loading ? 'Updating...' : 'Ready'}
                </div>
              </div>
            </div>
            
            {/* Pinecone Stats */}
            {pineconeStats.enabled && (
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 col-span-1">
                <div className="text-primary/70 font-medium mb-1 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Long-term Memory (Pinecone)
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-primary font-medium">
                    <span className="text-lg font-bold">{pineconeStats.vectorCount}</span> 
                    <span className="text-xs ml-1 text-primary/70">vectors</span>
                  </div>
                  <div className={`text-xs ${currentOperation !== 'none' || loadingPinecone 
                      ? 'text-rose-600 bg-rose-100' 
                      : 'text-emerald-600 bg-emerald-100'} 
                    px-2 py-1 rounded-full flex items-center`}>
                    {currentOperation !== 'none' && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                    {currentOperation !== 'none' 
                      ? 'Locked' 
                      : loadingPinecone 
                        ? 'Locking...' 
                        : 'Unlocked'}
                  </div>
                </div>
                
                {pineconeStats.activeIndex && (
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-primary/70 text-xs">Active Index:</div>
                    <div className="text-primary font-medium truncate max-w-[150px]">
                      {pineconeStats.activeIndex}
                    </div>
                  </div>
                )}
                
                {/* Operation status indicator */}
                {currentOperation !== 'none' && (
                  <div className="mt-2 pt-2 border-t border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="text-primary/70 text-xs">Operation:</div>
                      <div className="flex items-center">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin text-rose-500" />
                        <span className="text-xs font-medium text-rose-500">
                          {currentOperation === 'sync' ? 'Syncing' : 'Hydrating'}
                        </span>
                      </div>
                    </div>
                    {operationIndex && (
                      <div className="text-xs text-primary/70 mt-1 line-clamp-1">
                        Index: <span className="font-medium">{operationIndex}</span>
                        {operationNamespace && ` (${operationNamespace})`}
                      </div>
                    )}
                    <div className="text-[10px] text-rose-400 mt-1">
                      Memory system is locked until operation completes
                    </div>
                  </div>
                )}
                
                {/* Namespaces information has been simplified to avoid redundancy */}
              </div>
            )}
          </div>
        </div>
        
        {/* Embedding Visualization - Smaller sized */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-4 mb-5 border border-primary/10">
          <h3 className="text-xs font-semibold text-primary mb-1 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Memory Retrieval
          </h3>
          <div className="text-[10px] text-primary/60 mb-1">
            Embedding similarity visualization
          </div>
          <div className="rounded-lg overflow-hidden bg-gradient-to-b from-primary/5 to-white h-24 p-2 relative border border-primary/10">
            <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <radialGradient id="pulseGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </radialGradient>
              </defs>
              
              {/* Pulse effect for center node */}
              <circle cx="100" cy="50" r="10" fill="url(#pulseGradient)" className="animate-pulse-slow" />
              
              {/* Center node */}
              <circle cx="100" cy="50" r="3" fill="var(--color-primary)" />
              
              {relevantMemories.map((memory, i) => {
                // Position circles based on similarity (higher = closer)
                const distance = 30 * (1 - Math.min(memory.similarity, 0.99));
                const angle = (i / relevantMemories.length) * Math.PI * 2;
                const x = 100 + distance * Math.cos(angle);
                const y = 50 + distance * Math.sin(angle);
                
                return (
                  <React.Fragment key={memory.id}>
                    <line 
                      x1="100" 
                      y1="50" 
                      x2={x} 
                      y2={y} 
                      stroke="var(--color-primary)" 
                      strokeWidth="1" 
                      strokeOpacity={memory.similarity * 0.8} 
                      strokeDasharray={memory.similarity > 0.8 ? "none" : "2,2"}
                    />
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={2} 
                      fill={memory.similarity > 0.8 ? "var(--color-primary)" : "var(--color-primary-light)"} 
                    />
                  </React.Fragment>
                );
              })}
            </svg>
            <div className="absolute bottom-1 right-1">
              <div className="text-center text-[8px] font-mono text-primary/70 z-10 bg-white/80 backdrop-blur-sm px-1 py-0.5 rounded-md shadow-sm border border-primary/10">
                Query vector
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Memories */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-5 border border-primary/10">
          <h3 className="text-sm font-semibold text-primary mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Memories
          </h3>
          <div className="text-xs text-primary/60 mb-4">
            Recently stored conversation fragments
          </div>
          
          <div className="space-y-3">
            {memories.slice(0, 3).map((memory) => (
              <div key={memory.id} className="bg-primary/5 rounded-lg p-3 text-xs border border-primary/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-primary flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Memory #{memory.id}
                  </span>
                  <span className="text-primary/60 text-xs">
                    {memory.timestamp 
                      ? format(new Date(memory.timestamp), 'MM/dd HH:mm') 
                      : 'Just now'}
                  </span>
                </div>
                <p className="text-primary/80 mb-2 line-clamp-2">{memory.content}</p>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    memory.type === 'prompt' 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-primary/10 text-primary/80'
                  }`}>
                    {memory.type === 'prompt' ? 'USER' : 'AI'}
                  </span>
                  {memory.similarity !== undefined && (
                    <span className="text-primary/60 text-[10px] flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      Similarity: {memory.similarity.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination controls */}
          {total > 0 && (
            <div className="mt-4 flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="text-xs p-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              
              <span className="text-xs text-primary/70">
                Page {page} of {Math.ceil(total / pageSize)}
                {loading && <span className="ml-2 animate-pulse">Loading...</span>}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={page * pageSize >= total || loading}
                className="text-xs p-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          )}
          
          {memories.length === 0 && (
            <div className="bg-primary/5 rounded-lg border border-primary/10 p-6 text-center text-primary/70 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No memories stored yet.</p>
              <p className="text-xs mt-1">Start a conversation to create memories</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
