import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
// Initialize Anthropic client with API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Generate a response from Anthropic Claude
export async function generateResponse(
  prompt: string, 
  context: string,
  model: string = "claude-3-7-sonnet-20250219"
): Promise<string> {
  try {
    // Create a system message with enhanced context handling
    const systemMessage = context 
      ? `You are the Structured Memory Engine, an AI assistant with access to relevant memories from previous conversations. 
Use the following retrieved memories to provide accurate and contextually relevant responses. 
When a user asks about personal preferences, biographical details, or other personal information:
- If the information exists in these memories, use it confidently
- If no relevant memory exists, acknowledge this and offer to remember if they provide the information
- Never invent personal attributes or preferences not found in memories

Here are the retrieved memories and system information:

${context}`
      : "You are a helpful assistant called the Structured Memory Engine that uses RAG (Retrieval Augmented Generation) to access relevant memories from previous conversations.";
    
    const message = await anthropic.messages.create({
      model: model,
      system: systemMessage,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    });
    
    return message.content[0].text;
  } catch (error) {
    console.error("Error generating response from Anthropic:", error);
    throw new Error(`Failed to generate response from Anthropic: ${error.message}`);
  }
}

// Check if the API key is valid
export async function validateApiKey(): Promise<boolean> {
  try {
    // Try to list models to validate the API key
    await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    return true;
  } catch (error) {
    console.error("Error validating Anthropic API key:", error);
    return false;
  }
}

// Get available models - Anthropic doesn't have a list models endpoint
// so we'll return hardcoded values
export async function getAvailableModels(): Promise<string[]> {
  return [
    "claude-3-7-sonnet-20250219",
    "claude-instant-1.2",
  ];
}

export default {
  generateResponse,
  validateApiKey,
  getAvailableModels,
};
