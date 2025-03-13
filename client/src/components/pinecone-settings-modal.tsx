import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface PineconeIndex {
  name: string;
  dimension: number;
  metric: string;
  host: string;
  vectorCount: number;
  namespaces: { name: string; vectorCount: number }[];
}

interface PineconeSettings {
  id: number;
  isEnabled: boolean;
  vectorDimension: number;
  activeIndexName: string | null;
  namespace: string;
  lastSyncTimestamp: string | null;
}

interface PineconeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PineconeSettingsModal: React.FC<PineconeSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<PineconeSettings | null>(null);
  const [indexes, setIndexes] = useState<PineconeIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [selectedTab, setSelectedTab] = useState('settings');
  
  // Form values for creating a new index
  const [newIndexName, setNewIndexName] = useState('');
  const [dimension, setDimension] = useState(1536); // Default dimension for embeddings
  const [metric, setMetric] = useState('cosine');
  
  // Values for syncing memories
  const [syncNamespace, setSyncNamespace] = useState('default');
  const [selectedIndex, setSelectedIndex] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      checkPineconeAvailability();
    }
  }, [isOpen]);
  
  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/settings');
      setSettings(response);
      setSyncNamespace(response.namespace || 'default');
      setSelectedIndex(response.activeIndexName || '');
    } catch (error) {
      console.error('Error fetching Pinecone settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Pinecone settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const checkPineconeAvailability = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/status');
      setIsAvailable(response.available);
      
      if (response.available) {
        fetchIndexes();
      }
    } catch (error) {
      console.error('Error checking Pinecone availability:', error);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchIndexes = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/indexes');
      setIndexes(response);
    } catch (error) {
      console.error('Error fetching Pinecone indexes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Pinecone indexes",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateSettings = async (newSettings: Partial<PineconeSettings>) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/pinecone/settings', {
        method: 'PATCH',
        data: newSettings
      });
      setSettings(response);
      toast({
        title: "Success",
        description: "Pinecone settings updated successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Error updating Pinecone settings:', error);
      toast({
        title: "Error",
        description: "Failed to update Pinecone settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const createIndex = async () => {
    if (!newIndexName) {
      toast({
        title: "Error",
        description: "Index name is required",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreatingIndex(true);
    try {
      await apiRequest('/api/pinecone/indexes', {
        method: 'POST',
        data: {
          name: newIndexName,
          dimension,
          metric
        }
      });
      
      toast({
        title: "Success",
        description: `Index ${newIndexName} created successfully`,
        variant: "default"
      });
      
      // Clear the form
      setNewIndexName('');
      
      // Refresh indexes
      fetchIndexes();
      
    } catch (error) {
      console.error('Error creating Pinecone index:', error);
      toast({
        title: "Error",
        description: "Failed to create Pinecone index",
        variant: "destructive"
      });
    } finally {
      setIsCreatingIndex(false);
    }
  };
  
  const deleteIndex = async (indexName: string) => {
    if (!confirm(`Are you sure you want to delete the index "${indexName}"? This action cannot be undone.`)) {
      return;
    }
    
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
      
    } catch (error) {
      console.error('Error deleting Pinecone index:', error);
      toast({
        title: "Error",
        description: "Failed to delete Pinecone index",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const syncToPinecone = async () => {
    if (!selectedIndex) {
      toast({
        title: "Error",
        description: "Please select an index for syncing",
        variant: "destructive"
      });
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await apiRequest('/api/pinecone/sync', {
        method: 'POST',
        data: {
          indexName: selectedIndex,
          namespace: syncNamespace
        }
      });
      
      toast({
        title: "Success",
        description: `Successfully synced ${result.count} memories to Pinecone`,
        variant: "default"
      });
      
      // Update active index and namespace in settings
      updateSettings({
        activeIndexName: selectedIndex,
        namespace: syncNamespace,
        isEnabled: true
      });
      
      // Refresh indexes to see updated vector counts
      fetchIndexes();
      
    } catch (error) {
      console.error('Error syncing to Pinecone:', error);
      toast({
        title: "Error",
        description: "Failed to sync memories to Pinecone",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  const hydrateFromPinecone = async () => {
    if (!selectedIndex) {
      toast({
        title: "Error",
        description: "Please select an index for hydration",
        variant: "destructive"
      });
      return;
    }
    
    if (!confirm("This will clear all existing memories in the database and replace them with memories from Pinecone. Are you sure you want to continue?")) {
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await apiRequest('/api/pinecone/hydrate', {
        method: 'POST',
        data: {
          indexName: selectedIndex,
          namespace: syncNamespace,
          limit: 1000 // Limit to 1000 vectors to prevent overwhelming the system
        }
      });
      
      toast({
        title: "Success",
        description: `Successfully hydrated ${result.count} memories from Pinecone`,
        variant: "default"
      });
      
      // Update active index and namespace in settings
      updateSettings({
        activeIndexName: selectedIndex,
        namespace: syncNamespace,
        isEnabled: true
      });
      
      // Refresh cached memories
      queryClient.invalidateQueries({ queryKey: ['/api/memories'] });
      
    } catch (error) {
      console.error('Error hydrating from Pinecone:', error);
      toast({
        title: "Error",
        description: "Failed to hydrate memories from Pinecone",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Pinecone Vector Database Integration</DialogTitle>
          <DialogDescription>
            Configure Pinecone integration for persistent memory storage.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          <div className="flex items-center space-x-2 mb-4">
            <span>Status:</span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isAvailable ? (
              <div className="flex items-center">
                <Badge variant="success" className="bg-green-500 text-white mr-2">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
                {settings?.activeIndexName && (
                  <span className="text-sm text-muted-foreground">
                    Active index: {settings.activeIndexName}
                  </span>
                )}
              </div>
            ) : (
              <Badge variant="destructive" className="bg-destructive text-destructive-foreground">
                <AlertCircle className="h-3 w-3 mr-1" /> Disconnected
              </Badge>
            )}
          </div>
          
          <Tabs defaultValue="settings" onValueChange={setSelectedTab} value={selectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="indexes">Indexes</TabsTrigger>
              <TabsTrigger value="sync">Sync & Hydrate</TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings" className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="pinecone-enabled" 
                  checked={settings?.isEnabled || false}
                  onCheckedChange={(checked) => updateSettings({ isEnabled: checked })}
                  disabled={!isAvailable || isLoading}
                />
                <Label htmlFor="pinecone-enabled">Enable Pinecone Integration</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="vector-dimension">Vector Dimension</Label>
                <Input 
                  id="vector-dimension" 
                  type="number" 
                  value={settings?.vectorDimension || 1536}
                  onChange={(e) => updateSettings({ vectorDimension: parseInt(e.target.value) })}
                  disabled={!isAvailable || isLoading || settings?.isEnabled}
                />
                <p className="text-sm text-muted-foreground">
                  Dimension of vectors stored in Pinecone. This should match your embedding model's dimensions.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="namespace">Default Namespace</Label>
                <Input 
                  id="namespace" 
                  value={settings?.namespace || 'default'}
                  onChange={(e) => updateSettings({ namespace: e.target.value })}
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Default namespace for organizing vectors in Pinecone.
                </p>
              </div>
              
              {settings?.lastSyncTimestamp && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    Last synchronized: {new Date(settings.lastSyncTimestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="indexes" className="space-y-4 py-4">
              <div className="space-y-4 mb-6 p-4 border rounded-md">
                <h3 className="text-lg font-medium">Create New Index</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="index-name">Index Name</Label>
                  <Input 
                    id="index-name" 
                    value={newIndexName}
                    onChange={(e) => setNewIndexName(e.target.value)}
                    disabled={isCreatingIndex}
                    placeholder="my-memory-index"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dimension">Dimension</Label>
                  <Input 
                    id="dimension" 
                    type="number" 
                    value={dimension}
                    onChange={(e) => setDimension(parseInt(e.target.value))}
                    disabled={isCreatingIndex}
                  />
                  <p className="text-sm text-muted-foreground">
                    Must match your embedding model's dimension (1536 for OpenAI ada-002).
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metric">Distance Metric</Label>
                  <Select 
                    value={metric} 
                    onValueChange={setMetric}
                    disabled={isCreatingIndex}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cosine">Cosine Similarity</SelectItem>
                      <SelectItem value="euclidean">Euclidean Distance</SelectItem>
                      <SelectItem value="dotproduct">Dot Product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={createIndex}
                  disabled={!isAvailable || isCreatingIndex || !newIndexName}
                  className="w-full mt-4"
                >
                  {isCreatingIndex && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Index
                </Button>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium mb-2">Existing Indexes</h3>
                
                {indexes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {isLoading ? 'Loading indexes...' : 'No indexes found. Create one to get started.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {indexes.map((index) => (
                      <div 
                        key={index.name} 
                        className="p-3 border rounded-md flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{index.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {index.dimension}d {index.metric} · {index.vectorCount.toLocaleString()} vectors · {index.namespaces.length} namespace(s)
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedIndex(index.name);
                              setSelectedTab('sync');
                            }}
                          >
                            Use
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => deleteIndex(index.name)}
                            disabled={isLoading}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="sync" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sync-index">Select Index</Label>
                <Select 
                  value={selectedIndex} 
                  onValueChange={setSelectedIndex}
                  disabled={isSyncing || indexes.length === 0}
                >
                  <SelectTrigger id="sync-index">
                    <SelectValue placeholder="Select index" />
                  </SelectTrigger>
                  <SelectContent>
                    {indexes.map((index) => (
                      <SelectItem key={index.name} value={index.name}>
                        {index.name} ({index.dimension}d)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sync-namespace">Namespace</Label>
                <Input 
                  id="sync-namespace" 
                  value={syncNamespace}
                  onChange={(e) => setSyncNamespace(e.target.value)}
                  disabled={isSyncing}
                  placeholder="default"
                />
              </div>
              
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <h4 className="font-medium">Sync to Pinecone</h4>
                  <p className="text-sm text-muted-foreground">
                    Push current memories to Pinecone for persistent storage.
                  </p>
                  <Button 
                    onClick={syncToPinecone}
                    disabled={!isAvailable || isSyncing || !selectedIndex}
                    className="w-full mt-2"
                  >
                    {isSyncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Sync to Pinecone
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Hydrate from Pinecone</h4>
                  <p className="text-sm text-muted-foreground">
                    Replace all local memories with data from Pinecone. This will clear existing memories.
                  </p>
                  <Button 
                    onClick={hydrateFromPinecone}
                    variant="outline"
                    disabled={!isAvailable || isSyncing || !selectedIndex}
                    className="w-full mt-2"
                  >
                    {isSyncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Hydrate from Pinecone
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};