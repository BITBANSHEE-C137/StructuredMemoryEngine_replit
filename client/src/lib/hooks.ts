import { useState, useEffect, useRef, useCallback } from "react";
import { MEMORY_PANEL_BREAKPOINT } from "./constants";
import { Message, Settings, Model, ApiStatus } from "./types";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";
import { API_ROUTES } from "./constants";
import { useToast } from "@/hooks/use-toast";

// Hook to detect if screen is mobile
export function useMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MEMORY_PANEL_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MEMORY_PANEL_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

// Hook to manage chat messages state
export function useChatMessages() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch messages from the API
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.MESSAGES);
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = await response.json();
      // Messages come in reverse chronological order from the server (newest first)
      // but we need to display them in chronological order (oldest first)
      // No need to use reverse() as the server already returns them in the correct order from DB
      setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load message history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Send a message and get a response
  const sendMessage = useCallback(async (content: string, modelId: string) => {
    setIsLoading(true);
    
    // Optimistically add user message to state
    const tempUserMessage: Message = {
      id: -Date.now(), // Temporary negative ID
      content,
      role: "user",
      timestamp: new Date().toISOString(),
      modelId
    };
    
    // Add the temporary message at the end (chronological order)
    setMessages(prev => [...prev, tempUserMessage]);
    
    try {
      const response = await apiRequest(API_ROUTES.CHAT, {
        method: 'POST',
        data: { 
          content, 
          modelId 
        }
      });
      
      // Update messages with the real data from API
      setMessages(prev => {
        // Filter out the temporary message
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        
        // Get the user message and assistant message
        const userMessage = {
          id: Math.abs(tempUserMessage.id),
          content,
          role: "user",
          timestamp: new Date().toISOString(),
          modelId
        };
        
        // Attach the relevant memories to the assistant's response message directly
        const assistantMessage = {
          ...response.message,
          relevantMemories: response.context?.relevantMemories || []
        };
        
        // Add both real messages in correct order (chronological)
        // The user message followed by the assistant response
        return [...filtered, userMessage, assistantMessage];
      });
      
      // Return the context for memory panel
      return response.context;
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
      
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Add a new message to the state
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  // Clear all messages from the state
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, fetchMessages, sendMessage, addMessage, clearMessages };
}

// Hook to manage settings
export function useSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch settings from the API
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.SETTINGS);
      if (!response.ok) throw new Error("Failed to fetch settings");
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Update settings
  const updateSettings = useCallback(async (updatedSettings: Partial<Settings>) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(API_ROUTES.SETTINGS, {
        method: 'PATCH',
        data: updatedSettings
      });
      setSettings(response);
      toast({
        title: "Success",
        description: "Settings updated successfully"
      });
      return response;
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { settings, isLoading, fetchSettings, updateSettings };
}

// Hook to manage models
export function useModels() {
  const { toast } = useToast();
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch enabled models from the API
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.MODELS_ENABLED);
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error("Error fetching models:", error);
      toast({
        title: "Error",
        description: "Failed to load AI models",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { models, isLoading, fetchModels };
}

// Hook to check API status
export function useApiStatus() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch API status
  const checkApiStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ROUTES.HEALTH);
      if (!response.ok) throw new Error("Failed to check API status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error checking API status:", error);
      toast({
        title: "Error",
        description: "Failed to check API connection status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { status, isLoading, checkApiStatus };
}

// Hook for auto-resizing textarea
export function useAutosizeTextarea() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('input', adjustHeight);
      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}
