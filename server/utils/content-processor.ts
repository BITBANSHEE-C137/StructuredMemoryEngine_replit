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
 * Performs enhanced keyword matching to find relevant text segments
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
  const normalizedContent = content.toLowerCase();
  
  // Extract both individual words and multi-word phrases
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 2) // Ignore short words
    .map(word => word.replace(/[^\w]/g, '')); // Remove punctuation
  
  // Also create 2-3 word phrases for important concepts
  const queryPhrases: string[] = [];
  const words = normalizedQuery.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    // Two-word phrases
    if (words[i].length > 1 && words[i+1].length > 1) {
      queryPhrases.push(`${words[i]} ${words[i+1]}`.toLowerCase());
    }
    
    // Three-word phrases
    if (i < words.length - 2 && words[i].length > 1 && words[i+1].length > 1 && words[i+2].length > 1) {
      queryPhrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`.toLowerCase());
    }
  }
  
  if (queryWords.length === 0 && queryPhrases.length === 0) {
    return 0;
  }
  
  // Count individual word matches with score for each word
  let wordScore = 0;
  for (const word of queryWords) {
    // Check if word exists in content
    if (normalizedContent.includes(word)) {
      // Exact match as a whole word gets higher score
      const wholeWordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wholeWordRegex.test(normalizedContent)) {
        wordScore += 1.5; // Higher score for whole word matches
      } else {
        wordScore += 0.5; // Lower score for partial matches
      }
      
      // Bonus for multiple occurrences (up to 1.0 extra)
      const occurrences = (normalizedContent.match(new RegExp(word, 'gi')) || []).length;
      if (occurrences > 1) {
        wordScore += Math.min(1.0, (occurrences - 1) * 0.2);
      }
    }
  }
  
  // Normalize word score
  const maxWordScore = queryWords.length * 2.5; // Max possible score including all bonuses
  const normalizedWordScore = wordScore / maxWordScore;
  
  // Check for phrase matches (these are more significant)
  let phraseScore = 0;
  for (const phrase of queryPhrases) {
    if (normalizedContent.includes(phrase)) {
      // Phrases get a higher score as they indicate stronger topical relevance
      phraseScore += 3.0;
      
      // Bonus for phrases appearing at the start of content (likely more relevant)
      if (normalizedContent.indexOf(phrase) < 50) {
        phraseScore += 1.0;
      }
    }
  }
  
  // Normalize phrase score
  const maxPhraseScore = queryPhrases.length * 4.0; // Max possible including all bonuses
  const normalizedPhraseScore = phraseScore / (maxPhraseScore || 1); // Prevent division by zero
  
  // Combine scores, giving more weight to phrase matches when available
  if (queryPhrases.length > 0) {
    return (normalizedWordScore * 0.4) + (normalizedPhraseScore * 0.6);
  } else {
    return normalizedWordScore;
  }
}

/**
 * Calculate hybrid relevance score combining vector similarity and keyword matching
 * @param vectorSimilarity The vector similarity score (0-1)
 * @param keywordScore The keyword matching score (0-1)
 * @param weights Optional weights for each component (default: 0.6 vector, 0.4 keyword)
 * @returns Combined relevance score between 0 and 1
 */
export function calculateHybridScore(
  vectorSimilarity: number, 
  keywordScore: number,
  weights: { vector: number, keyword: number } = { vector: 0.6, keyword: 0.4 }
): number {
  // Ensure weights sum to 1
  const totalWeight = weights.vector + weights.keyword;
  const normalizedWeights = {
    vector: weights.vector / totalWeight,
    keyword: weights.keyword / totalWeight
  };
  
  // Boost score if both vector and keyword metrics are strong
  // This helps surface truly relevant content that scores well on both dimensions
  const combinedScore = (vectorSimilarity * normalizedWeights.vector) + 
                       (keywordScore * normalizedWeights.keyword);
  
  // Apply a boosting factor when both scores are good
  if (vectorSimilarity > 0.6 && keywordScore > 0.5) {
    // Boost up to 15% for strong matches on both dimensions
    const boostFactor = Math.min(0.15, (vectorSimilarity + keywordScore) * 0.075);
    return Math.min(1.0, combinedScore + boostFactor);
  }
  
  return combinedScore;
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
  
  console.log(`Applying hybrid ranking to ${memories.length} memories with query: "${query}"`);
  
  // Extract query keywords for logging
  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w.replace(/[^\w]/g, ''));
  
  console.log(`Query keywords: ${queryWords.join(', ')}`);
  
  // Calculate hybrid scores for each memory
  const hybridResults = memories.map(memory => {
    const keywordScore = performKeywordMatch(query, memory.content);
    const hybridScore = calculateHybridScore(memory.similarity, keywordScore);
    
    // More permissive threshold for hybrid scoring
    const adjustedThreshold = originalThreshold * 0.85;
    
    // Strong keyword matches can override vector similarity threshold
    // This allows highly relevant content to surface even with lower vector similarity
    const hasStrongKeywordMatch = keywordScore > 0.6;
    const hasModerateKeywordMatch = keywordScore > 0.4;
    
    // Three ways to meet the threshold:
    // 1. Vector similarity alone is high enough
    // 2. Hybrid score is decent AND has moderate keyword relevance
    // 3. Keyword relevance is very high (direct topic match)
    const meetsThreshold = 
      memory.similarity >= originalThreshold || 
      (hybridScore >= adjustedThreshold && hasModerateKeywordMatch) ||
      hasStrongKeywordMatch;
    
    return {
      ...memory,
      originalSimilarity: memory.similarity,
      keywordScore,
      hybridScore,
      meetsThreshold
    };
  });
  
  // Log hybrid scoring results
  const beforeFilterCount = hybridResults.length;
  const meetingThresholdCount = hybridResults.filter(m => m.meetsThreshold).length;
  
  console.log(`Hybrid ranking: ${meetingThresholdCount} of ${beforeFilterCount} memories meet threshold criteria`);
  
  // Filter and sort by hybrid score
  const result = hybridResults
    .filter(m => m.meetsThreshold)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .map(m => {
      // Get normalized hybrid score rounded to 2 decimal places
      let adjustedSimilarity = Math.round(m.hybridScore * 100) / 100;
      
      // IMPORTANT FIX: Prevent exact 1.0 (100%) scores to avoid confusion
      // Also prevent multiple results with exactly the same score
      if (adjustedSimilarity >= 0.995) {
        // If it's a true 100% match, make it 99% instead
        // Add a small random value to differentiate multiple near-exact matches
        const randomAdj = Math.random() * 0.01; // tiny random adjustment between 0 and 0.01
        adjustedSimilarity = 0.99 - randomAdj;
      }
      
      return {
        ...m,
        similarity: adjustedSimilarity
      };
    });
  
  // Log top results for debugging
  if (result.length > 0) {
    console.log(`Top hybrid results (showing up to 3):`);
    result.slice(0, 3).forEach((m, i) => {
      const contentPreview = m.content.substring(0, 50).replace(/\n/g, ' ');
      console.log(`${i+1}. Score: ${m.hybridScore.toFixed(2)} (V:${m.originalSimilarity.toFixed(2)}, K:${m.keywordScore.toFixed(2)}) - Display: ${m.similarity.toFixed(2)} - ${contentPreview}...`);
      
      // If it's an exact match, log specifically to help with debugging
      if (m.originalSimilarity > 0.99 || m.content.trim().toLowerCase() === query.trim().toLowerCase()) {
        console.log(`   ⚠️ EXACT MATCH DETECTED: Original score ${m.originalSimilarity} adjusted to ${m.similarity}`);
        console.log(`   ⚠️ Query: "${query}", Content: "${m.content.substring(0, 100)}"`);
      }
    });
  } else {
    console.log(`No memories met the relevance threshold criteria`);
  }
  
  return result;
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