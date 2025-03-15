import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate embeddings for a given text using the configured embedding model
export async function generateEmbedding(text: string, embeddingModel: string = "text-embedding-3-small"): Promise<string> {
  try {
    console.log(`Generating embedding using model: ${embeddingModel}`);
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: text,
    });
    
    // Return the embedding as a properly formatted vector string for pgvector
    // Format: [1.2, 3.4, 5.6, ...]
    const embeddingArray = response.data[0].embedding;
    return `[${embeddingArray.join(',')}]`;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding from OpenAI");
  }
}

// Generate a response from OpenAI
export async function generateResponse(
  prompt: string, 
  context: string, 
  model: string = "gpt-4o"
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
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    return response.choices[0].message.content || "No response generated";
  } catch (error: any) {
    console.error("Error generating response from OpenAI:", error);
    throw new Error(`Failed to generate response from OpenAI: ${error.message}`);
  }
}

// Check if the API key is valid
export async function validateApiKey(): Promise<boolean> {
  try {
    // Make a simple request to validate the API key
    await openai.models.list();
    return true;
  } catch (error) {
    console.error("Error validating OpenAI API key:", error);
    return false;
  }
}

// Get available models
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await openai.models.list();
    // Filter for common chat models
    const chatModels = response.data
      .filter(model => 
        model.id.includes("gpt-") && 
        !model.id.includes("instruct") &&
        !model.id.includes("embedding") &&
        !model.id.includes("davinci") &&
        !model.id.includes("babbage") &&
        !model.id.includes("curie") &&
        !model.id.includes("ada")
      )
      .map(model => model.id);
    
    return chatModels;
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
    return [];
  }
}

export default {
  generateEmbedding,
  generateResponse,
  validateApiKey,
  getAvailableModels,
};
