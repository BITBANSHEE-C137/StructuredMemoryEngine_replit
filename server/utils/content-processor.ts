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
  
  // Enhanced question handling for contextual queries
  // This is critical for questions like "what's my favorite car?"
  const isQueryQuestion = normalizedQuery.includes("?") || 
                        normalizedQuery.startsWith("what") || 
                        normalizedQuery.startsWith("who") || 
                        normalizedQuery.startsWith("when") || 
                        normalizedQuery.startsWith("where") || 
                        normalizedQuery.startsWith("why") || 
                        normalizedQuery.startsWith("how") ||
                        normalizedQuery.startsWith("can you") ||
                        normalizedQuery.startsWith("could you");
  
  // Special handling for personal preference questions
  if (isQueryQuestion) {
    // Extract "favorite X" pattern
    const favoritesMatch = normalizedQuery.match(/(?:my|your|their|his|her|our)?\s*(?:favorite|preferred|best)\s+(\w+)/i);
    if (favoritesMatch) {
      const favoriteSubject = favoritesMatch[1]; // e.g., "car", "color", etc.
      
      console.log(`[content-processor] Detected favorite query about: ${favoriteSubject}`);
      
      // Check if content contains this type of information with higher sensitivity
      if (
        (normalizedContent.includes("favorite") || normalizedContent.includes("prefer") || normalizedContent.includes("best")) && 
        normalizedContent.includes(favoriteSubject)
      ) {
        // If the content contains statements about favorites of the requested subject
        // this is potentially a direct answer to the query
        console.log(`[content-processor] Found potential favorite ${favoriteSubject} answer in content`);
        return 0.95; // Very high relevance for direct preference answers
      }
      
      // Check for simple mentions of the subject in responses (might be partial answers)
      if (normalizedContent.includes(favoriteSubject)) {
        // Give strong preference to any mention of the subject in memories
        return 0.85; // Good relevance for subject-related memories
      }
    }
    
    // Special handling for possession, identity or attribute questions
    const attributeMatch = normalizedQuery.match(/(?:what|which|who)\s+(?:is|are|was|were)?\s+(?:my|your|their|his|her|our)\s+(\w+)/i);
    if (attributeMatch) {
      const attribute = attributeMatch[1]; // e.g., "name", "age", "car", etc.
      
      // Check if content answers this possession/identity question
      if (normalizedContent.includes(attribute) && 
          (normalizedContent.includes("your") || normalizedContent.includes("my") || 
           normalizedContent.includes("is") || normalizedContent.includes("are"))) {
        return 0.90; // High relevance for potential answers about possessions/attributes
      }
    }
  }
  
  // Check for exact model numbers and brand-model combinations (high-value matches)
  // This helps match things like "Ferrari 308GTSi" or "308GTSi" directly
  const brandModelRegex = /\b([a-z]+[\s-]?[0-9]+[a-z0-9]*)\b/gi;
  const queryBrandModels = normalizedQuery.match(brandModelRegex) || [];
  const contentBrandModels = normalizedContent.match(brandModelRegex) || [];
  
  // Direct brand-model matches get very high scores
  let brandModelScore = 0;
  for (const brandModel of queryBrandModels) {
    const normalizedBrandModel = brandModel.toLowerCase();
    if (contentBrandModels.some(cm => cm.toLowerCase().includes(normalizedBrandModel))) {
      brandModelScore += 5.0; // Very high score for direct brand-model matches
      console.log(`Brand-model match found: "${normalizedBrandModel}" in query matches content`);
    }
  }
  
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
  
  // Special case for short queries that might be entity names or model numbers
  if (queryWords.length <= 2 && normalizedQuery.length > 0) {
    // For short queries like "Ferrari" or "308GTSi", ensure they're represented
    const shortQueryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    for (const word of shortQueryWords) {
      if (!queryWords.includes(word) && word.length > 1) {
        queryWords.push(word);
      }
    }
  }
  
  if (queryWords.length === 0 && queryPhrases.length === 0 && brandModelScore === 0) {
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
  const maxWordScore = Math.max(1, queryWords.length * 2.5); // Max possible score including all bonuses
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
  const maxPhraseScore = Math.max(1, queryPhrases.length * 4.0); // Max possible including all bonuses
  const normalizedPhraseScore = phraseScore / maxPhraseScore;
  
  // Normalize brand-model score
  const maxBrandModelScore = Math.max(1, queryBrandModels.length * 5.0);
  const normalizedBrandModelScore = brandModelScore / maxBrandModelScore;
  
  // Combine scores, prioritizing brand-model matches the most
  if (brandModelScore > 0) {
    // When we have brand-model matches, they dominate the score
    return Math.min(1.0, 0.7 * normalizedBrandModelScore + 0.2 * normalizedPhraseScore + 0.1 * normalizedWordScore);
  } else if (queryPhrases.length > 0) {
    // Otherwise, prioritize phrase matches when available
    return Math.min(1.0, 0.4 * normalizedWordScore + 0.6 * normalizedPhraseScore);
  } else {
    // Fall back to just word matches
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
    
    // Dynamically calculate adjusted threshold based on user's setting
    // Using a percentage-based adjustment to respect user's preferences
    const permissiveness = 0.85; // Reduces threshold by 15% for hybrid scoring
    const adjustedThreshold = originalThreshold * permissiveness;
    
    // Define keyword thresholds relative to the user's similarity setting
    // This ensures the system adapts to the user's preference for strictness
    const strongKeywordThreshold = Math.max(0.6, originalThreshold * 0.8);
    const moderateKeywordThreshold = Math.max(0.4, originalThreshold * 0.6);
    
    // Strong keyword matches can override vector similarity threshold
    // This allows highly relevant content to surface even with lower vector similarity
    const hasStrongKeywordMatch = keywordScore > strongKeywordThreshold;
    const hasModerateKeywordMatch = keywordScore > moderateKeywordThreshold;
    
    console.log(`Memory evaluation: Vector similarity ${memory.similarity.toFixed(2)} (threshold ${originalThreshold.toFixed(2)}), ` +
                `Keyword score ${keywordScore.toFixed(2)} (strong: ${strongKeywordThreshold.toFixed(2)}, moderate: ${moderateKeywordThreshold.toFixed(2)})`);
    
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