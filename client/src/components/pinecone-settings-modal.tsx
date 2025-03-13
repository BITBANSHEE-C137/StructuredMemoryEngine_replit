import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, AlertCircle, Key } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { usePineconeSettings } from '@/hooks/usePineconeSettings';
import { useToast } from '@/hooks/use-toast';

interface PineconeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PineconeSettingsModal: React.FC<PineconeSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
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
    wipeIndex,
    syncToPinecone,
    hydrateFromPinecone
  } = usePineconeSettings();
  
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
      checkAvailability();
    }
  }, [isOpen, fetchSettings, checkAvailability]);
  
  useEffect(() => {
    if (settings) {
      setSyncNamespace(settings.namespace || 'default');
      setSelectedIndex(settings.activeIndexName || '');
    }
  }, [settings]);
  
  // Load indexes when the settings tab is active and Pinecone is available
  useEffect(() => {
    if (isOpen && isAvailable && selectedTab === 'settings') {
      fetchIndexes();
    }
  }, [isOpen, isAvailable, selectedTab, fetchIndexes]);
  
  const handleCreateIndex = async () => {
    setIsCreatingIndex(true);
    try {
      await createIndex(newIndexName, dimension, metric);
      setNewIndexName('');
    } finally {
      setIsCreatingIndex(false);
    }
  };
  
  const handleDeleteIndex = async (indexName: string) => {
    if (!confirm(`Are you sure you want to delete the index "${indexName}"? This action cannot be undone.`)) {
      return;
    }
    
    await deleteIndex(indexName);
  };
  
  const handleWipeIndex = async (indexName: string, namespace: string = 'default') => {
    if (!confirm(`Are you sure you want to wipe all vectors from index "${indexName}"? This will clear all data but keep the index.`)) {
      return;
    }
    
    await wipeIndex(indexName, namespace);
  };
  
  const handleSyncToPinecone = async () => {
    if (!selectedIndex) {
      return;
    }
    
    setIsSyncing(true);
    try {
      await syncToPinecone(selectedIndex, syncNamespace);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleHydrateFromPinecone = async () => {
    if (!selectedIndex) {
      return;
    }
    
    if (!confirm("This will retrieve memories from Pinecone and merge them with your local database. Existing memories will be preserved. Continue?")) {
      return;
    }
    
    setIsSyncing(true);
    try {
      await hydrateFromPinecone(selectedIndex, syncNamespace, 1000);
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span>Status:</span>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : isAvailable ? (
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-green-500 text-white mr-2">
                    <Check className="h-3 w-3 mr-1" /> Connected
                  </Badge>
                  {settings?.activeIndexName && (
                    <span className="text-sm text-muted-foreground">
                      Active index: {settings.activeIndexName}
                    </span>
                  )}
                </div>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" /> Disconnected
                </Badge>
              )}
            </div>
            
            {!isAvailable && (
              <Button 
                size="sm" 
                variant="outline" 
                className="flex items-center"
                onClick={() => {
                  onClose(); // Close the modal before redirecting
                  
                  // Redirect to settings to get API key
                  window.location.href = '/?request=pinecone_api_key';
                }}
              >
                <Key className="h-3 w-3 mr-1" /> Add API Key
              </Button>
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

              <div className="space-y-2 pt-2">
                <Label htmlFor="active-index">Active Index</Label>
                <Select 
                  value={settings?.activeIndexName || "none"} 
                  onValueChange={(value) => updateSettings({ activeIndexName: value === "none" ? null : value })}
                  disabled={isLoading || !isAvailable || indexes.length === 0}
                >
                  <SelectTrigger id="active-index">
                    <SelectValue placeholder="Select active index" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {indexes.map(index => (
                      <SelectItem key={index.name} value={index.name}>
                        {index.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  The active index will be used for memory operations when Pinecone is enabled.
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
                  onClick={handleCreateIndex}
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
                        className="p-3 border rounded-md"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{index.name}</h4>
                            <div className="text-xs text-muted-foreground space-y-1 mt-1">
                              <p>Dimension: {index.dimension}</p>
                              <p>Metric: {index.metric}</p>
                              <p>Total vectors: {index.vectorCount}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {settings?.activeIndexName === index.name && (
                              <Badge variant="outline" className="mr-2">
                                Active
                              </Badge>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleWipeIndex(index.name, settings?.namespace || 'default')}
                              disabled={isLoading}
                              className="mr-1"
                            >
                              Wipe
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteIndex(index.name)}
                              disabled={isLoading}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        
                        {index.namespaces && index.namespaces.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium mb-1">Namespaces:</p>
                            <div className="flex flex-wrap gap-1">
                              {index.namespaces.map(ns => (
                                <Badge key={ns.name} variant="secondary" className="text-xs">
                                  {ns.name}: {ns.vectorCount}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="sync" className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sync-index">Select Index</Label>
                  <Select 
                    value={selectedIndex} 
                    onValueChange={setSelectedIndex}
                    disabled={isSyncing || indexes.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select index" />
                    </SelectTrigger>
                    <SelectContent>
                      {indexes.map(index => (
                        <SelectItem key={index.name} value={index.name}>
                          {index.name}
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
                  <p className="text-sm text-muted-foreground">
                    Namespaces help organize vectors within an index.
                  </p>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Button 
                    onClick={handleSyncToPinecone}
                    disabled={!isAvailable || isSyncing || !selectedIndex}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>Sync Local Memories to Pinecone</>
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Pushes all local vector memories to the selected Pinecone index.
                  </p>
                </div>
                
                <div className="flex flex-col space-y-2 mt-2">
                  <Button 
                    onClick={handleHydrateFromPinecone}
                    disabled={!isAvailable || isSyncing || !selectedIndex}
                    variant="outline"
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Hydrating...
                      </>
                    ) : (
                      <>Hydrate from Pinecone</>
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Retrieves and merges memories from Pinecone with your local database.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {settings?.isEnabled ? 'Pinecone integration is enabled' : 'Pinecone integration is disabled'}
          </div>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};