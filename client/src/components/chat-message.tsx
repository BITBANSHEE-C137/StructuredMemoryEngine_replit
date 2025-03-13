import React from 'react';
import { Message, RelevantMemory } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
  relevantMemories?: RelevantMemory[];
  isLast?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  relevantMemories,
  isLast = false,
}) => {
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
          {/* Relevant memories section for assistant responses */}
          {!isUser && relevantMemories && relevantMemories.length > 0 && (
            <div className="mb-3 p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs">
              <div className="font-medium text-primary/80 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Retrieved Memories:
              </div>
              <div className="space-y-1.5">
                {relevantMemories.map((memory) => (
                  <div key={memory.id} className="pl-2 border-l-2 border-primary/20">
                    <span className="text-primary/70 font-medium mr-1">{(memory.similarity * 100).toFixed(0)}%</span>
                    {memory.content.length > 100 
                      ? `${memory.content.substring(0, 100)}...` 
                      : memory.content}
                  </div>
                ))}
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
