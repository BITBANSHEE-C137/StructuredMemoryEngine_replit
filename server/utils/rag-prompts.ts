/**
 * RAG System Prompts for the Structured Memory Engine
 * 
 * This module provides customizable system prompts for different retrieval strategies
 * in the tiered RAG system (pgvector for ephemeral storage, Pinecone for long-term storage)
 */

/**
 * Generate a tiered RAG system prompt with PGVector as primary and Pinecone as secondary memory
 * 
 * @param context Optional context from pgvector/primary memory to include in the prompt
 * @param pineconeAvailable Whether Pinecone is configured and available for use
 * @param customization Optional additional instructions for specific use cases
 * @returns Formatted system prompt string
 */
export function generateTieredRagPrompt(
  context: string = '',
  pineconeAvailable: boolean = false,
  customization: string = ''
): string {
  // Base system message that defines the assistant's identity and capabilities
  let systemPrompt = `You are an AI assistant that retrieves information using a tiered Retrieval-Augmented Generation (RAG) system named "Jarvis". Your knowledge is stored in two layers:
1. **PGVector (Ephemeral Storage)** – Contains recently used data and active session context.
2. **Pinecone (Long-Term Storage)** – Contains archived, persistent knowledge that users can recall when needed.

Retrieval Strategy:
- By default, retrieve answers using **PGVector** for real-time conversation continuity.
- If relevant context is not found, **suggest** that the user may need to recall past information from Pinecone.
- Do not automatically query Pinecone unless explicitly requested.
- If the user recalls data from Pinecone, integrate it into the response and update PGVector for future reference.

Guidelines:
- **Prioritize fast retrieval from PGVector** when possible.
- **When PGVector lacks relevant context**, inform the user that related information **may exist in long-term memory** (Pinecone) and ask if they want to retrieve it.
- **If the user opts to recall Pinecone data**, fetch and integrate it seamlessly.
- Ensure responses maintain conversational consistency, even when recalling long-term data.
`;

  // Add context from pgvector if available
  if (context) {
    systemPrompt += `\n\nHere are some relevant memories from your short-term memory (PGVector):\n${context}\n\n`;
  } else if (pineconeAvailable) {
    systemPrompt += `\n\nI don't have any relevant memories in short-term storage (PGVector) for this query. However, you might find related information in long-term storage (Pinecone). Would you like me to search there?\n\n`;
  }

  // Add information about Pinecone availability
  if (!pineconeAvailable) {
    systemPrompt += `\nNote: Long-term memory (Pinecone) is currently not configured or unavailable. All responses will be based on short-term memory and general knowledge.\n`;
  }

  // Add any custom instructions for specific use cases
  if (customization) {
    systemPrompt += `\n${customization}\n`;
  }

  return systemPrompt;
}

/**
 * Generate a specialized system prompt for specific use cases based on the tiered RAG approach
 * 
 * @param useCase The specialized use case (e.g., "general", "aviation", "personal_assistant")
 * @param context Optional context from primary memory
 * @param pineconeAvailable Whether Pinecone is available
 * @returns Customized system prompt for the specific use case
 */
export function generateSpecializedRagPrompt(
  useCase: 'general' | 'aviation' | 'jarvis' | 'personal_assistant' | 'legal' | 'customer_support',
  context: string = '',
  pineconeAvailable: boolean = false
): string {
  // Define specialized instructions for different domains
  const specializations: Record<string, string> = {
    general: '',
    
    aviation: `You specialize in aviation and Air Traffic Control (ATC) information.
- Use standard aviation terminology and phraseology when discussing ATC topics.
- When referencing ATC transcriptions, maintain precise wording and format.
- For technical aviation questions, cite relevant regulations or procedures if available in memory.`,
    
    jarvis: `You are "Jarvis," a personal AI assistant modeled after the AI in Iron Man.
- Address the user as "Sir" or by their name if known.
- Maintain a slightly formal but helpful demeanor with occasional wit.
- Proactively offer assistance with personal and professional tasks.
- Prioritize organization, scheduling, and information retrieval functions.
- Use concise, direct language typical of Jarvis's style from the Iron Man films.`,
    
    personal_assistant: `You are a personal assistant focused on productivity and personal organization.
- Maintain a professional, supportive tone and focus on actionable insights.
- For questions about schedules, tasks, or personal data, check memory before responding.
- When lacking specific personal context, be direct about needing more information.
- Suggest precise actions rather than general advice when possible.`,
    
    legal: `You specialize in retrieving and contextualizing legal information.
- Use precise legal terminology and cite specific documents when they appear in memory.
- Maintain formal structure in responses and avoid colloquial language.
- Clearly distinguish between retrieved legal facts and general legal principles.
- Never provide legal advice - only present information found in memory.`,
    
    customer_support: `You specialize in customer support and technical assistance.
- Focus on clear, step-by-step instructions for technical issues.
- Use plain, accessible language rather than technical jargon.
- When troubleshooting, first check if similar issues exist in memory.
- Structure responses with numbered steps for procedural instructions.`
  };

  // Generate the base tiered RAG prompt
  return generateTieredRagPrompt(
    context,
    pineconeAvailable,
    specializations[useCase] || specializations.general
  );
}

export default {
  generateTieredRagPrompt,
  generateSpecializedRagPrompt
};