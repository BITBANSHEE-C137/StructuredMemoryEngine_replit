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
      "flex items-start",
      isUser && "justify-end"
    )}>
      {/* Avatar for non-user messages */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      
      <div className={cn(
        "max-w-3xl text-sm px-4 py-3 rounded-lg",
        isUser 
          ? "mr-3 bg-secondary text-white rounded-tr-none" 
          : "ml-3 bg-neutral rounded-tl-none"
      )}>
        {/* Relevant memories section for assistant responses */}
        {!isUser && relevantMemories && relevantMemories.length > 0 && (
          <div className="mb-3 p-2 bg-primary bg-opacity-5 rounded border border-primary border-opacity-10 text-xs">
            <div className="font-medium text-secondary mb-1">Retrieved Memories:</div>
            {relevantMemories.map((memory, index) => (
              <p key={memory.id} className={index < relevantMemories.length - 1 ? "mb-1" : ""}>
                • {memory.content.length > 100 
                  ? `${memory.content.substring(0, 100)}...` 
                  : memory.content}
              </p>
            ))}
          </div>
        )}
        
        {/* Message content with linkification and formatting */}
        <div className="whitespace-pre-wrap">
          {message.content.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Avatar for user messages */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
};
