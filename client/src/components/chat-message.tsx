import React from 'react';
import { Message, RelevantMemory } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLast = false,
}) => {
  // Use memories attached to the message itself (if available)
  const relevantMemories = message.relevantMemories;
  const similarityThreshold = message.context?.similarityThreshold; // Get similarity threshold
  const thresholdDetails = message.context?.thresholdDetails; // Get detailed threshold information
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "group relative",
      isUser ? "bg-gray-50" : "bg-white"
    )}>
      {/* Role label on the left (always visible for clarity) */}
      <div className="absolute left-8 top-3.5 sm:left-12 text-xs font-semibold opacity-70 text-gray-500">
        {isUser ? 'You' : 'AI'}
      </div>
      
      <div className="px-4 py-6 sm:px-16 max-w-3xl mx-auto flex">
        {/* Avatar */}
        <div className="flex-shrink-0 mr-4">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          )}
        </div>
      
        <div className="flex-1 min-w-0">
          {/* Enhanced Relevant memories section for assistant responses */}
          {!isUser && relevantMemories && (
            <div className="mb-3 rounded-xl border border-primary/10 text-xs overflow-hidden">
              {/* Header with status badge */}
              <div className="bg-primary/10 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center text-primary font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Retrieved Memories</span>
                </div>
                <div className="flex items-center space-x-2">
                  {relevantMemories.length > 0 && (
                    <div className="text-[10px] font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                      {relevantMemories.length} memories
                    </div>
                  )}
                  
                  <div className={`text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center ${
                    relevantMemories.length > 0 
                      ? "bg-green-100 text-green-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {relevantMemories.length > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                        RAG Active
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1"></span>
                        No Context
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Content section */}
              <div className="p-3">
                {/* Only show memories for assistant messages (not user messages) */}
                {relevantMemories && relevantMemories.length > 0 && message.role === 'assistant' ? (
                  <>
                    <div className="text-[10px] text-primary/70 mb-2 flex justify-between items-center">
                      <span>Showing relevant context used to generate this response</span>
                      <div className="flex gap-2">
                        {thresholdDetails ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${thresholdDetails.isQuestion ? 'bg-blue-500' : 'bg-purple-500'}`}></span>
                              {thresholdDetails.isQuestion ? 'Question' : 'Statement'} Mode
                            </span>
                            <div className="grid grid-cols-3 gap-1 text-center">
                              <span className="font-medium text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded">
                                Base: {(thresholdDetails.baseThreshold * 100).toFixed(1)}%
                              </span>
                              <span className="font-medium text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded">
                                Factor: {(thresholdDetails.adjustmentFactor * 100).toFixed(0)}%
                              </span>
                              <span className="font-medium text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded">
                                Final: {(thresholdDetails.adjustedThreshold * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ) : similarityThreshold ? (
                          <span className="font-medium text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded">
                            Threshold: {(similarityThreshold * 100).toFixed(1)}%
                          </span>
                        ) : null}
                        <span className="font-medium text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded">
                          Similarity: {relevantMemories.length > 0 && Math.min(...relevantMemories.map(m => m.similarity)) > 0 
                            ? `${(Math.min(...relevantMemories.map(m => m.similarity)) * 100).toFixed(1)}%` 
                            : '0.0%'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {relevantMemories.map((memory, index) => (
                        <div key={memory.id} 
                          className={`p-2 rounded-lg border ${
                            memory.similarity > 0.85 
                              ? "border-green-200 bg-green-50" 
                              : memory.similarity > 0.7 
                                ? "border-blue-200 bg-blue-50" 
                                : memory.similarity > 0.5
                                  ? "border-purple-100 bg-purple-50"
                                  : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center">
                              <div className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center mr-1.5 text-[10px] font-bold">
                                {index + 1}
                              </div>
                              <span className="font-medium text-primary/90">Memory #{memory.id}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {memory.similarity > 0.85 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                                  High relevance
                                </span>
                              )}
                              <span 
                                className={`inline-block min-w-16 text-center text-[10px] font-medium py-0.5 px-1.5 rounded-md ${
                                  memory.similarity > 0.85 
                                    ? "bg-green-200 text-green-800" 
                                    : memory.similarity > 0.7 
                                      ? "bg-blue-200 text-blue-800" 
                                      : memory.similarity > 0.5
                                        ? "bg-purple-200 text-purple-800"
                                        : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                {(memory.similarity * 100).toFixed(1)}% match
                              </span>
                            </div>
                          </div>
                          <div className="relative">
                            <div className="absolute top-0 bottom-0 left-0 w-1 rounded-full bg-primary/20"></div>
                            <div className="pl-3 pr-1 text-primary/90 py-1">
                              {memory.content.length > 150 
                                ? `${memory.content.substring(0, 150)}...` 
                                : memory.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-2 text-[10px] text-primary/60 pt-1 border-t border-dashed border-primary/20">
                      Memory retrieval powered by vector embedding similarity search.
                    </div>
                  </>
                ) : (
                  <div className="py-4 flex flex-col items-center justify-center text-primary/70">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="font-medium">No relevant memories found</div>
                    <div className="text-[10px] mt-1 text-center max-w-[200px]">
                      This response was generated without context from previous conversations
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        
          {/* Message content with formatting */}
          <div className={cn(
            "prose max-w-none break-words text-sm text-gray-800"
          )}>
            {message.content.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
