/**
 * Content Processing Utilities
 * 
 * This module contains functions to clean, process, and optimize content
 * before generating embeddings, improving the quality of vector search results.
 */

/**
 * Cleans content by removing UI elements, formatting, and standardizing text
 * @param content The raw content string to clean
 * @returns Cleaned content string
 */
export function cleanContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let cleaned = content;

  // Remove UI metadata markers
  cleaned = cleaned.replace(/AI\s*Retrieved\s*Memories(\s|\n)*([0-9]+)\s*memories(\s|\n)*RAG\s*Active/g, '');
  cleaned = cleaned.replace(/Memory\s*retrieval\s*powered\s*by\s*vector\s*embedding\s*similarity\s*search/g, '');
  cleaned = cleaned.replace(/Showing\s*relevant\s*context\s*used\s*to\s*generate\s*this\s*response/g, '');
  cleaned = cleaned.replace(/Similarity:\s*[0-9.]+%/g, '');
  cleaned = cleaned.replace(/Memory\s*#[0-9]+/g, '');
  cleaned = cleaned.replace(/High\s*relevance/g, '');
  cleaned = cleaned.replace(/[0-9.]+%\s*match/g, '');

  // Standardize spacing
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{2,}/g, '\n\n');
  
  // Trim whitespace
  cleaned = cleaned.trim();

  // Ensure there's reasonable content left after cleaning
  if (cleaned.length < 10 && content.length > 10) {
    // If cleaning removed too much, revert to the original but still trim
    return content.trim();
  }

  return cleaned;
}

/**
 * Extracts key concepts and information from text
 * @param content The content to extract key concepts from
 * @returns Content with key concepts highlighted
 */
export function extractKeyInfo(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // First clean the content
  const cleaned = cleanContent(content);
  
  // Extract sentences with likely important info (questions, direct statements, etc.)
  const keyPhrases = [];
  
  // Split into sentences
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    // Keep questions
    if (sentence.trim().endsWith('?')) {
      keyPhrases.push(sentence.trim());
      continue;
    }
    
    // Keep sentences with important keywords/indicators
    const importantKeywords = ['because', 'therefore', 'important', 'key', 'main', 'significant', 'crucial', 'essential'];
    if (importantKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
      keyPhrases.push(sentence.trim());
      continue;
    }
    
    // Keep short definitive statements
    if (sentence.trim().length < 100 && !sentence.includes(',')) {
      keyPhrases.push(sentence.trim());
      continue;
    }
  }
  
  // If we extracted reasonable key phrases, use them
  if (keyPhrases.length > 0 && keyPhrases.join(' ').length >= cleaned.length * 0.3) {
    return keyPhrases.join(' ');
  }
  
  // Otherwise return the cleaned content
  return cleaned;
}

/**
 * Intelligently chunks longer content into manageable segments for better embedding
 * @param content The content to chunk
 * @param maxChunkSize The maximum size of each chunk (characters)
 * @returns Array of content chunks
 */
export function chunkContent(content: string, maxChunkSize: number = 500): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }
  
  // If content is already smaller than the max chunk size, return it as is
  if (content.length <= maxChunkSize) {
    return [content];
  }
  
  const chunks: string[] = [];
  
  // Prefer splitting on paragraph boundaries
  const paragraphs = content.split(/\n{2,}/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If this paragraph alone exceeds the chunk size, split by sentences
    if (paragraph.length > maxChunkSize) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      
      for (const sentence of sentences) {
        // If this sentence alone exceeds chunk size, split arbitrarily
        if (sentence.length > maxChunkSize) {
          // Add what we've accumulated so far as a chunk
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
          }
          
          // Split the long sentence into fixed-size chunks
          for (let i = 0; i < sentence.length; i += maxChunkSize) {
            chunks.push(sentence.slice(i, i + maxChunkSize));
          }
        }
        // Otherwise check if adding this sentence would exceed the chunk size
        else if (currentChunk.length + sentence.length + 1 > maxChunkSize) {
          // Store current chunk and start a new one with this sentence
          chunks.push(currentChunk);
          currentChunk = sentence;
        } 
        else {
          // Add this sentence to current chunk
          currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        }
      }
    }
    // If adding this paragraph would exceed chunk size
    else if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      // Store current chunk and start a new one with this paragraph
      chunks.push(currentChunk);
      currentChunk = paragraph;
    }
    else {
      // Add this paragraph to current chunk
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    }
  }
  
  // Add the final chunk if there is one
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Processes content for optimal embedding
 * @param content The raw content to process
 * @param options Processing options
 * @returns Processed content, or array of content chunks if chunking is enabled
 */
export function processContentForEmbedding(
  content: string, 
  options: { 
    clean?: boolean; 
    extract?: boolean; 
    chunk?: boolean;
    maxChunkSize?: number;
  } = {}
): string | string[] {
  const { clean = true, extract = false, chunk = false, maxChunkSize = 500 } = options;
  
  if (!content) {
    return chunk ? [] : '';
  }
  
  let processed = content;
  
  // Step 1: Clean the content if requested
  if (clean) {
    processed = cleanContent(processed);
  }
  
  // Step 2: Extract key information if requested
  if (extract) {
    processed = extractKeyInfo(processed);
  }
  
  // Step 3: Chunk the content if requested
  if (chunk) {
    return chunkContent(processed, maxChunkSize);
  }
  
  return processed;
}

/**
 * Performs simple keyword matching to find relevant text segments
 * @param query The search query
 * @param content The content to search in
 * @returns Score between 0 and 1 representing keyword relevance
 */
export function performKeywordMatch(query: string, content: string): number {
  if (!query || !content) {
    return 0;
  }
  
  // Normalize and split query into keywords
  const normalizedQuery = query.toLowerCase().trim();
  const queryKeywords = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 2) // Ignore short words
    .map(word => word.replace(/[^\w]/g, '')); // Remove punctuation
  
  if (queryKeywords.length === 0) {
    return 0;
  }
  
  // Normalize content
  const normalizedContent = content.toLowerCase();
  
  // Count keyword matches
  let matchCount = 0;
  for (const keyword of queryKeywords) {
    if (normalizedContent.includes(keyword)) {
      matchCount++;
    }
  }
  
  // Calculate score based on percentage of matched keywords
  return matchCount / queryKeywords.length;
}

/**
 * Calculate hybrid relevance score combining vector similarity and keyword matching
 * @param vectorSimilarity The vector similarity score (0-1)
 * @param keywordScore The keyword matching score (0-1)
 * @param weights Optional weights for each component (default: 0.7 vector, 0.3 keyword)
 * @returns Combined relevance score between 0 and 1
 */
export function calculateHybridScore(
  vectorSimilarity: number, 
  keywordScore: number,
  weights: { vector: number, keyword: number } = { vector: 0.7, keyword: 0.3 }
): number {
  // Ensure weights sum to 1
  const totalWeight = weights.vector + weights.keyword;
  const normalizedWeights = {
    vector: weights.vector / totalWeight,
    keyword: weights.keyword / totalWeight
  };
  
  // Calculate weighted score
  return (vectorSimilarity * normalizedWeights.vector) + 
         (keywordScore * normalizedWeights.keyword);
}

/**
 * Applies hybrid relevance scoring to a list of memories with vector similarities
 * @param query The user's query
 * @param memories Array of memories with vector similarities
 * @param originalThreshold The original vector similarity threshold
 * @returns Memories sorted by hybrid score with updated similarity values
 */
export function applyHybridRanking<T extends { content: string; similarity: number }>(
  query: string,
  memories: Array<T>,
  originalThreshold: number = 0.75
): Array<T & { originalSimilarity?: number; keywordScore?: number; hybridScore?: number }> {
  if (!memories || memories.length === 0 || !query) {
    return memories;
  }
  
  // Calculate hybrid scores for each memory
  const hybridResults = memories.map(memory => {
    const keywordScore = performKeywordMatch(query, memory.content);
    const hybridScore = calculateHybridScore(memory.similarity, keywordScore);
    
    // Adjust the threshold for hybrid scoring to be slightly more permissive
    const adjustedThreshold = originalThreshold * 0.9;
    
    // Only include memories that meet either the vector threshold or have strong keyword matches
    const meetsThreshold = 
      memory.similarity >= originalThreshold || 
      (hybridScore >= adjustedThreshold && keywordScore > 0.3);
    
    return {
      ...memory,
      originalSimilarity: memory.similarity,
      keywordScore,
      hybridScore,
      meetsThreshold
    };
  });
  
  // Filter and sort by hybrid score
  return hybridResults
    .filter(m => m.meetsThreshold)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .map(m => ({
      ...m,
      similarity: Math.round(m.hybridScore * 100) / 100 // Round to 2 decimal places for display
    }));
}

export default {
  cleanContent,
  extractKeyInfo,
  chunkContent,
  processContentForEmbedding,
  performKeywordMatch,
  calculateHybridScore,
  applyHybridRanking
};