import { useState, useCallback } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PineconeSettings {
  id: number;
  isEnabled: boolean;
  vectorDimension: number;
  activeIndexName: string | null;
  namespace: string;
  lastSyncTimestamp: string | null;
}

interface PineconeIndex {
  name: string;
  dimension: number;
  metric: string;
  host: string;
  vectorCount: number;
  namespaces: { name: string; vectorCount: number }[];
}

interface SyncResult {
  success: boolean;
  count: number;
}

export function usePineconeSettings() {
  const [settings, setSettings] = useState<PineconeSettings | null>(null);
  const [indexes, setIndexes] = useState<PineconeIndex[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/settings');
      setSettings(response);
      return response;
    } catch (error) {
      console.error('Error fetching Pinecone settings:', error);
      // Provide a default settings object if we couldn't fetch from the server
      // This prevents the UI from breaking when Pinecone isn't available yet
      const defaultSettings = {
        id: 1,
        isEnabled: false,
        vectorDimension: 1536,
        activeIndexName: null,
        namespace: 'default',
        lastSyncTimestamp: null
      };
      setSettings(defaultSettings);
      return defaultSettings;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const updateSettings = useCallback(async (updatedSettings: Partial<PineconeSettings>) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/settings', {
        method: 'PATCH',
        data: updatedSettings
      });
      setSettings(response);
      toast({
        title: "Success",
        description: "Pinecone settings updated successfully",
        variant: "default"
      });
      return response;
    } catch (error) {
      console.error('Error updating Pinecone settings:', error);
      toast({
        title: "Error",
        description: "Failed to update Pinecone settings",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const checkAvailability = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/status');
      const isAvailable = response?.available || false;
      setIsAvailable(isAvailable);
      if (isAvailable) {
        fetchIndexes();
      }
      return isAvailable;
    } catch (error) {
      console.error('Error checking Pinecone availability:', error);
      setIsAvailable(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchIndexes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/indexes');
      setIndexes(response);
      return response;
    } catch (error) {
      console.error('Error fetching Pinecone indexes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Pinecone indexes",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createIndex = useCallback(async (name: string, dimension: number = 1536, metric: string = 'cosine') => {
    setIsLoading(true);
    try {
      await apiRequest('/api/pinecone/indexes', {
        method: 'POST',
        data: { name, dimension, metric }
      });
      
      toast({
        title: "Success",
        description: `Index ${name} created successfully`,
        variant: "default"
      });
      
      // Refresh indexes
      fetchIndexes();
      return true;
    } catch (error) {
      console.error('Error creating Pinecone index:', error);
      toast({
        title: "Error",
        description: "Failed to create Pinecone index",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchIndexes, toast]);

  const deleteIndex = useCallback(async (indexName: string) => {
    setIsLoading(true);
    try {
      await apiRequest(`/api/pinecone/indexes/${indexName}`, {
        method: 'DELETE'
      });
      
      toast({
        title: "Success",
        description: `Index ${indexName} deleted successfully`,
        variant: "default"
      });
      
      // Refresh indexes
      fetchIndexes();
      
      // Update settings if active index was deleted
      if (settings?.activeIndexName === indexName) {
        updateSettings({ activeIndexName: null });
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting Pinecone index:', error);
      toast({
        title: "Error",
        description: "Failed to delete Pinecone index",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchIndexes, settings, updateSettings, toast]);

  const syncToPinecone = useCallback(async (indexName: string, namespace: string = 'default') => {
    setIsLoading(true);
    try {
      const result = await apiRequest('/api/pinecone/sync', {
        method: 'POST',
        data: { indexName, namespace }
      });
      
      toast({
        title: "Success",
        description: `Successfully synced ${result.count} memories to Pinecone`,
        variant: "default"
      });
      
      // Update active index and namespace in settings
      updateSettings({
        activeIndexName: indexName,
        namespace: namespace,
        isEnabled: true
      });
      
      // Refresh indexes to see updated vector counts
      fetchIndexes();
      
      return result;
    } catch (error) {
      console.error('Error syncing to Pinecone:', error);
      toast({
        title: "Error",
        description: "Failed to sync memories to Pinecone",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchIndexes, updateSettings, toast]);

  const hydrateFromPinecone = useCallback(async (indexName: string, namespace: string = 'default', limit: number = 1000) => {
    setIsLoading(true);
    try {
      const result = await apiRequest('/api/pinecone/hydrate', {
        method: 'POST',
        data: { indexName, namespace, limit }
      });
      
      toast({
        title: "Success",
        description: `Successfully hydrated ${result.count} memories from Pinecone`,
        variant: "default"
      });
      
      // Update active index and namespace in settings
      updateSettings({
        activeIndexName: indexName,
        namespace: namespace,
        isEnabled: true
      });
      
      // Refresh cached memories
      queryClient.invalidateQueries({ queryKey: ['/api/memories'] });
      
      return result;
    } catch (error) {
      console.error('Error hydrating from Pinecone:', error);
      toast({
        title: "Error",
        description: "Failed to hydrate memories from Pinecone",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [updateSettings, toast]);

  return {
    settings,
    indexes,
    isAvailable,
    isLoading,
    fetchSettings,
    updateSettings,
    checkAvailability,
    fetchIndexes,
    createIndex,
    deleteIndex,
    syncToPinecone,
    hydrateFromPinecone
  };
}