import Anthropic from '@anthropic-ai/sdk';
import ragPrompts from './rag-prompts';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
// Initialize Anthropic client with API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Generate a response from Anthropic Claude
export async function generateResponse(
  prompt: string, 
  context: string,
  model: string = "claude-3-7-sonnet-20250219",
  isPineconeAvailable: boolean = false,
  useCase: 'general' | 'aviation' | 'jarvis' | 'personal_assistant' | 'legal' | 'customer_support' = 'jarvis'
): Promise<string> {
  try {
    // Create a system message with context using the tiered RAG prompts
    const systemMessage = ragPrompts.generateSpecializedRagPrompt(
      useCase,
      context,
      isPineconeAvailable
    );
    
    const message = await anthropic.messages.create({
      model: model,
      system: systemMessage,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    });
    
    // Handle different types of content blocks
    if (message.content && message.content.length > 0 && 'text' in message.content[0]) {
      return message.content[0].text;
    }
    
    return "No response generated";
  } catch (error: any) { // Use 'any' type for error to avoid TS issues
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
