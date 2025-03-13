import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, AlertCircle, Key, CircleAlert, RefreshCw, CheckCircle, Clock, Info as InfoIcon, Download as DownloadCloud } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { usePineconeSettings } from '@/hooks/usePineconeSettings';
import { usePineconeStats } from '@/hooks/usePineconeStats';
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
    hydrateFromPinecone,
    fetchVectorsFromIndex,
    // Operation lock states
    currentOperation,
    operationIndex,
    operationNamespace
  } = usePineconeSettings();
  
  // Add Pinecone stats hook for real-time stats refresh
  const { stats, refetch: refreshStats, isLoading: isStatsLoading } = usePineconeStats();
  
  // Separate state variables for different operations
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  
  // Track last operation results for deduplication metrics display
  const [selectedTab, setSelectedTab] = useState('settings');
  
  // Form values for creating a new index
  const [newIndexName, setNewIndexName] = useState('');
  const [dimension, setDimension] = useState(1536); // Default dimension for embeddings
  const [metric, setMetric] = useState('cosine');
  
  // Values for syncing memories
  const [syncNamespace, setSyncNamespace] = useState('default');
  const [selectedIndex, setSelectedIndex] = useState('');
  
  // Track deduplication information from last sync
  const [lastSyncResults, setLastSyncResults] = useState<{
    count: number;
    duplicateCount?: number;
    dedupRate?: number;
    totalProcessed?: number;
    vectorCount?: number;
    indexName?: string;
    namespace?: string;
    timestamp: Date;
  } | null>(null);
  
  // Track deduplication information from last hydrate
  const [lastHydrateResult, setLastHydrateResult] = useState<{
    count: number;
    duplicateCount?: number;
    dedupRate?: number;
    totalProcessed?: number;
    vectorCount?: number;
    indexName?: string;
    namespace?: string;
    timestamp: Date;
  } | null>(null);
  
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
      // After creating an index, refresh the indexes list and stats
      await fetchIndexes();
      await refreshStats();
    } finally {
      setIsCreatingIndex(false);
    }
  };
  
  const handleDeleteIndex = async (indexName: string) => {
    if (!confirm(`Are you sure you want to delete the index "${indexName}"? This action cannot be undone.`)) {
      return;
    }
    
    setIsSyncing(true);
    try {
      await deleteIndex(indexName);
      // After deleting an index, refresh the indexes list and stats
      await fetchIndexes();
      await refreshStats();
    } catch (error) {
      console.error('Error deleting index:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleWipeIndex = async (indexName: string, namespace: string = 'default') => {
    if (!confirm(`Are you sure you want to wipe all vectors from index "${indexName}"? This will clear all data but keep the index.`)) {
      return;
    }
    
    setIsSyncing(true);
    try {
      await wipeIndex(indexName, namespace);
      // After wiping an index, refresh stats to show updated vector count
      await refreshStats();
    } catch (error) {
      console.error('Error wiping index:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleSyncToPinecone = async () => {
    if (!selectedIndex) {
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await syncToPinecone(selectedIndex, syncNamespace);
      console.log('Sync result:', result);
      
      // Store the sync results for display
      if (result) {
        setLastSyncResults({
          count: result.count,
          duplicateCount: result.duplicateCount,
          dedupRate: result.dedupRate,
          totalProcessed: result.totalProcessed,
          vectorCount: result.vectorCount,
          indexName: result.indexName || selectedIndex,
          namespace: result.namespace || syncNamespace,
          timestamp: result.timestamp ? new Date(result.timestamp) : new Date()
        });
      }
      
      // Refresh stats after sync operation completes
      await refreshStats();
    } catch (error) {
      console.error('Error syncing to Pinecone:', error);
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
    
    setIsHydrating(true);
    try {
      const result = await hydrateFromPinecone(selectedIndex, syncNamespace, 1000);
      console.log('Hydrate result:', result);
      
      // Store the hydrate results for display
      if (result) {
        setLastHydrateResult({
          count: result.count,
          duplicateCount: result.duplicateCount,
          dedupRate: result.dedupRate,
          totalProcessed: result.totalProcessed,
          vectorCount: result.vectorCount,
          indexName: result.indexName || selectedIndex,
          namespace: result.namespace || syncNamespace,
          timestamp: result.timestamp ? new Date(result.timestamp) : new Date()
        });
      }
      
      // Refresh stats after hydrate operation completes
      await refreshStats();
    } catch (error) {
      console.error('Error hydrating from Pinecone:', error);
    } finally {
      setIsHydrating(false);
    }
  };
  
  // Handler for the Debug button
  const handleDebugVectors = async () => {
    if (!selectedIndex) {
      return;
    }
    
    // Use isSyncing temporarily as a general loading state for debug operations
    setIsSyncing(true);
    try {
      // Refresh stats before fetching vector data to ensure up-to-date counts
      await refreshStats();
      const data = await fetchVectorsFromIndex(selectedIndex, syncNamespace, 100);
      console.log('Vector data from Pinecone:', data);
      
      // Display the data more accessibly
      if (data?.vectors?.length > 0) {
        // Prepare enhanced vector information with metadata
        const vectorInfo = data.vectors.map((v: any) => ({
          id: v.id,
          metadata: v.metadata || {},
          hasValues: v.hasValues,
          dimension: v.valuesDimension || 0,
          score: v.score
        }));
        
        // Get metadata fields to create a summary of available metadata
        const metadataFieldsSet = new Set<string>();
        data.vectors.forEach((v: any) => {
          if (v.metadata) {
            Object.keys(v.metadata).forEach(key => metadataFieldsSet.add(key));
          }
        });
        const metadataFields = Array.from(metadataFieldsSet);
        
        // Create a sample table of metadata counts
        const metadataCounts: Record<string, number> = {};
        metadataFields.forEach(field => {
          metadataCounts[field] = data.vectors.filter((v: any) => 
            v.metadata && v.metadata[field] !== undefined
          ).length;
        });
        
        const debugWindow = window.open('', '_blank');
        if (debugWindow) {
          debugWindow.document.write(`
            <html>
              <head>
                <title>Pinecone Vector Debug - ${selectedIndex}</title>
                <style>
                  body { 
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    padding: 20px; 
                    line-height: 1.5;
                    max-width: 1200px;
                    margin: 0 auto;
                    color: #333;
                  }
                  h2 { border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 30px; }
                  h3 { margin-top: 25px; }
                  pre { 
                    background: #f5f5f5; 
                    padding: 16px; 
                    border-radius: 8px; 
                    overflow: auto; 
                    max-height: 400px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 14px;
                  }
                  .stats { 
                    display: flex; 
                    gap: 20px; 
                    flex-wrap: wrap;
                    margin-bottom: 20px;
                  }
                  .stat-box {
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 8px;
                    min-width: 200px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                  }
                  .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  .stat-label {
                    font-size: 14px;
                    color: #666;
                  }
                  table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                  }
                  th, td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: left;
                  }
                  th {
                    background-color: #f2f2f2;
                  }
                  tr:nth-child(even) {
                    background-color: #f9f9f9;
                  }
                  .actions {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                  }
                  button {
                    padding: 8px 16px;
                    background: #4a5568;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                  }
                  button:hover {
                    background: #2d3748;
                  }
                  .badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                  }
                  .badge-green {
                    background: #d1fae5;
                    color: #047857;
                  }
                  .badge-blue {
                    background: #dbeafe;
                    color: #1e40af;
                  }
                </style>
              </head>
              <body>
                <h1>Pinecone Vector Debug</h1>
                <div class="stats">
                  <div class="stat-box">
                    <div class="stat-value">${selectedIndex}</div>
                    <div class="stat-label">Index Name</div>
                  </div>
                  <div class="stat-box">
                    <div class="stat-value">${syncNamespace}</div>
                    <div class="stat-label">Namespace</div>
                  </div>
                  <div class="stat-box">
                    <div class="stat-value">${data.count || data.vectors.length}</div>
                    <div class="stat-label">Vectors Retrieved</div>
                  </div>
                  <div class="stat-box">
                    <div class="stat-value">${data.vectors[0]?.valuesDimension || 'Unknown'}</div>
                    <div class="stat-label">Vector Dimension</div>
                  </div>
                </div>
                
                <h2>Metadata Analysis</h2>
                <p>Overview of metadata fields present in vectors:</p>
                <table>
                  <tr>
                    <th>Field Name</th>
                    <th>Count</th>
                    <th>Coverage</th>
                  </tr>
                  ${metadataFields.map(field => `
                    <tr>
                      <td>${field}</td>
                      <td>${metadataCounts[field]}</td>
                      <td>${Math.round((metadataCounts[field] / data.vectors.length) * 100)}%</td>
                    </tr>
                  `).join('')}
                </table>
                
                <h2>Vector Preview</h2>
                <p>Showing ${data.vectors.length} vectors from index <strong>${selectedIndex}</strong>:</p>
                <pre>${JSON.stringify(vectorInfo, null, 2)}</pre>
                
                <h2>Raw Sample</h2>
                <p>Complete raw data for the first vector (includes full metadata):</p>
                <pre>${JSON.stringify(data.rawSample, null, 2)}</pre>
                
                <div class="actions">
                  <button onclick="window.print()">Print/Save as PDF</button>
                  <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(data)}, null, 2))">
                    Copy All Data to Clipboard
                  </button>
                </div>
              </body>
            </html>
          `);
        }
      } else {
        // No vectors found
        const debugWindow = window.open('', '_blank');
        if (debugWindow) {
          debugWindow.document.write(`
            <html>
              <head>
                <title>Pinecone Vector Debug - ${selectedIndex}</title>
                <style>
                  body { 
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    padding: 20px; 
                    line-height: 1.5;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                  }
                  .empty-state {
                    text-align: center;
                    padding: 40px;
                    background: #f9f9f9;
                    border-radius: 8px;
                    margin-top: 30px;
                  }
                  h2 { color: #4a5568; }
                </style>
              </head>
              <body>
                <h1>Pinecone Vector Debug</h1>
                <div class="empty-state">
                  <h2>No vectors found</h2>
                  <p>The index "${selectedIndex}" with namespace "${syncNamespace}" appears to be empty.</p>
                  <p>You may need to sync memories to this index first.</p>
                </div>
              </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Error in vector debugging:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Function to handle modal close request
  const handleCloseRequest = () => {
    // Only allow closing if no operation is in progress
    if (!isSyncing && !isHydrating) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseRequest}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pinecone Vector Database Integration</DialogTitle>
          <DialogDescription>
            Configure Pinecone integration for persistent memory storage.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2 overflow-y-auto flex-1">
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
            
            <div className="flex items-center gap-2">
              {isAvailable && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex items-center"
                  onClick={async () => {
                    await refreshStats();
                    await fetchIndexes();
                  }}
                  disabled={isStatsLoading}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isStatsLoading ? 'animate-spin' : ''}`} /> 
                  Refresh Stats
                </Button>
              )}
              
              {!isAvailable && (
                <div className="text-xs text-muted-foreground bg-amber-100/50 px-2 py-1 rounded-md">
                  <AlertCircle className="h-3 w-3 inline mr-1 text-amber-600" /> 
                  Pinecone API key is managed in secrets
                </div>
              )}
            </div>
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
                  disabled={isLoading || !isAvailable || indexes.length === 0 || isSyncing}
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
              
              {/* Stats summary box */}
              <div className="mt-4 p-3 bg-muted rounded-md space-y-2">
                <h4 className="text-sm font-medium flex items-center justify-between">
                  Pinecone Statistics
                  {isStatsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2" />}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Total vectors:</span> {stats.vectorCount}
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Active index:</span> {stats.activeIndex || 'None'}
                  </div>
                </div>
                
                {/* Deduplication Statistics - Display the last operation's deduplication metrics */}
                {(lastSyncResults || lastHydrateResult) && (
                  <div className="pt-2 mt-2 border-t border-muted-foreground/20">
                    <h5 className="text-xs font-medium mb-1">Last Operation Deduplication Metrics</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {lastSyncResults && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Sync Operation:</span> {lastSyncResults.count} vectors
                          </div>
                          {lastSyncResults.duplicateCount !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Duplicates Skipped:</span> {lastSyncResults.duplicateCount}
                            </div>
                          )}
                          {lastSyncResults.dedupRate !== undefined && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Deduplication Rate:</span> {(lastSyncResults.dedupRate * 100).toFixed(1)}%
                            </div>
                          )}
                          {lastSyncResults.timestamp && (
                            <div className="col-span-2 text-xs text-muted-foreground/80 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {new Date(lastSyncResults.timestamp).toLocaleTimeString()}
                            </div>
                          )}
                        </>
                      )}
                      
                      {lastHydrateResult && !lastSyncResults && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Hydrate Operation:</span> {lastHydrateResult.count} vectors
                          </div>
                          {lastHydrateResult.duplicateCount !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Duplicates Detected:</span> {lastHydrateResult.duplicateCount}
                            </div>
                          )}
                          {lastHydrateResult.dedupRate !== undefined && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Deduplication Rate:</span> {lastHydrateResult.dedupRate.toFixed(1)}%
                            </div>
                          )}
                          {lastHydrateResult.timestamp && (
                            <div className="col-span-2 text-xs text-muted-foreground/80 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {new Date(lastHydrateResult.timestamp).toLocaleTimeString()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Operations indicators removed */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                  {settings?.lastSyncTimestamp && (
                    <div className="text-xs text-muted-foreground">
                      Last sync: {new Date(settings.lastSyncTimestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
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
                              <p>
                                Total vectors: {index.vectorCount} 
                                {index.vectorCount === 0 && settings?.activeIndexName === index.name && (
                                  <span className="text-amber-500 ml-1">(Empty index)</span>
                                )}
                              </p>
                              {index.namespaces && index.namespaces.length > 0 && (
                                <div className="text-xs mt-1">
                                  <details>
                                    <summary className="cursor-pointer text-muted-foreground hover:text-blue-500 mb-1">
                                      Namespaces ({index.namespaces.length})
                                    </summary>
                                    <div className="pl-2 space-y-1 border-l-2 border-zinc-200 dark:border-zinc-700">
                                      {index.namespaces.map(ns => (
                                        <p key={ns.name || 'default'} className="flex justify-between">
                                          <span>{ns.name || '(default)'}</span>
                                          <span>{ns.vectorCount} vectors</span>
                                        </p>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {settings?.activeIndexName === index.name && (
                              <Badge variant="outline" className="mr-2 flex items-center">
                                <span className="mr-1">Active</span>
                                {index.vectorCount === 0 && (
                                  <CircleAlert className="h-3 w-3 text-amber-500" />
                                )}
                              </Badge>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleWipeIndex(index.name, settings?.namespace || 'default')}
                              disabled={isLoading || isSyncing}
                              className="mr-1"
                              title={isSyncing ? "Cannot wipe index during active operation" : ""}
                            >
                              Wipe
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteIndex(index.name)}
                              disabled={isLoading || isSyncing}
                              title={isSyncing ? "Cannot delete index during active operation" : ""}
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
                  
                  {/* Display deduplication stats with enhanced UI */}
                  {lastSyncResults && (
                    <div className="mt-3 p-3 bg-secondary/30 rounded-md border border-border">
                      <div className="text-sm font-medium mb-2 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                        Last Sync Results
                      </div>
                      
                      <div className="space-y-3">
                        {/* Operation Summary */}
                        <div className="bg-background/50 p-2 rounded-md border border-border/50">
                          <h4 className="text-xs font-medium mb-1">Operation Summary</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Vectors Processed:</span>
                              <span className="ml-1 font-medium">{lastSyncResults?.totalProcessed !== undefined ? lastSyncResults.totalProcessed : 0}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Successfully Synced:</span>
                              <span className="ml-1 font-medium">{lastSyncResults.count}</span>
                            </div>
                            <div className="col-span-2 text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {lastSyncResults.timestamp ? new Date(lastSyncResults.timestamp).toLocaleTimeString() : 'Unknown time'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Deduplication Stats */}
                        <div className="bg-background/50 p-2 rounded-md border border-border/50">
                          <h4 className="text-xs font-medium mb-1">Deduplication Stats</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Duplicates Found:</span>
                              <span className="ml-1 font-medium">{lastSyncResults.duplicateCount !== undefined ? lastSyncResults.duplicateCount : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dedup Rate:</span>
                              <span className="ml-1 font-medium">
                                {lastSyncResults.dedupRate !== undefined ? `${lastSyncResults.dedupRate.toFixed(1)}%` : 'N/A'}
                              </span>
                              {lastSyncResults.dedupRate === 0 && (
                                <span className="text-xs ml-1 text-muted-foreground">
                                  (No duplicates detected)
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {lastSyncResults.duplicateCount === 0 && lastSyncResults.totalProcessed !== undefined && lastSyncResults.totalProcessed > 0 && (
                            <div className="text-xs mt-1 text-muted-foreground bg-secondary/20 p-1 rounded">
                              <InfoIcon className="h-3 w-3 inline mr-1" />
                              No duplicates found. This could mean either:
                              <ul className="list-disc list-inside ml-2 mt-1">
                                <li>There were no duplicate memories to process</li>
                                <li>All memories were already properly deduplicated</li> 
                                <li>Memories were automatically overwritten in Pinecone</li>
                              </ul>
                            </div>
                          )}
                        </div>
                        
                        {/* Vector Store Status */}
                        {lastSyncResults.vectorCount !== undefined && (
                          <div className="bg-background/50 p-2 rounded-md border border-border/50">
                            <h4 className="text-xs font-medium mb-1">Vector Store Status</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div>
                                <span className="text-muted-foreground">Total Vectors:</span>
                                <span className="ml-1 font-medium">{lastSyncResults.vectorCount}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Index:</span>
                                <span className="ml-1 font-medium">{lastSyncResults.indexName || selectedIndex}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Namespace:</span>
                                <span className="ml-1 font-medium">{lastSyncResults.namespace || syncNamespace || 'default'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2 mt-2">
                  <Button 
                    onClick={handleHydrateFromPinecone}
                    disabled={!isAvailable || isHydrating || !selectedIndex}
                    variant="outline"
                    className="w-full"
                  >
                    {isHydrating ? (
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
                  
                  {/* Display hydration results with enhanced UI */}
                  {lastHydrateResult && (
                    <div className="mt-3 p-3 bg-secondary/30 rounded-md border border-border">
                      <div className="text-sm font-medium mb-2 flex items-center">
                        <DownloadCloud className="h-4 w-4 mr-1 text-blue-500" />
                        Last Hydration Results
                      </div>
                      
                      <div className="space-y-3">
                        {/* Operation Summary */}
                        <div className="bg-background/50 p-2 rounded-md border border-border/50">
                          <h4 className="text-xs font-medium mb-1">Operation Summary</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Vectors Processed:</span>
                              <span className="ml-1 font-medium">{lastHydrateResult.totalProcessed || 0}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Imported to Local:</span>
                              <span className="ml-1 font-medium">{lastHydrateResult.count}</span>
                            </div>
                            <div className="col-span-2 text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {lastHydrateResult.timestamp ? new Date(lastHydrateResult.timestamp).toLocaleTimeString() : 'Unknown time'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Deduplication Stats */}
                        <div className="bg-background/50 p-2 rounded-md border border-border/50">
                          <h4 className="text-xs font-medium mb-1">Deduplication Stats</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Duplicates Skipped:</span>
                              <span className="ml-1 font-medium">{lastHydrateResult.duplicateCount !== undefined ? lastHydrateResult.duplicateCount : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dedup Rate:</span>
                              <span className="ml-1 font-medium">
                                {lastHydrateResult.dedupRate !== undefined ? `${lastHydrateResult.dedupRate.toFixed(1)}%` : 'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          {lastHydrateResult.dedupRate !== undefined && lastHydrateResult.dedupRate > 0 && (
                            <div className="text-xs mt-1 text-muted-foreground bg-secondary/20 p-1 rounded">
                              <InfoIcon className="h-3 w-3 inline mr-1" />
                              High deduplication rate indicates that many memories were already present in your local database, which means the system is efficiently avoiding duplicates.
                            </div>
                          )}
                        </div>
                        
                        {/* Vector Store Status */}
                        {lastHydrateResult.vectorCount !== undefined && (
                          <div className="bg-background/50 p-2 rounded-md border border-border/50">
                            <h4 className="text-xs font-medium mb-1">Vector Store Stats</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div>
                                <span className="text-muted-foreground">Source Vectors:</span>
                                <span className="ml-1 font-medium">{lastHydrateResult.vectorCount}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Source Index:</span>
                                <span className="ml-1 font-medium">{lastHydrateResult.indexName || selectedIndex}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Namespace:</span>
                                <span className="ml-1 font-medium">{lastHydrateResult.namespace || syncNamespace || 'default'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Debug button */}
                  <Button 
                    onClick={handleDebugVectors}
                    disabled={!isAvailable || isLoading || !selectedIndex}
                    variant="secondary"
                    className="w-full mt-4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>Debug Vectors</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    View the raw vector data for debugging purposes. Opens in a new window.
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
          <Button onClick={handleCloseRequest} disabled={isSyncing || isHydrating || isLoading}>
            {isSyncing || isHydrating || isLoading ? (
              <span className="flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Operation in Progress
              </span>
            ) : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};