import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate embeddings for a given text using ada-002 model
export async function generateEmbedding(text: string): Promise<string> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    // Return the embedding as a string
    return JSON.stringify(response.data[0].embedding);
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
    // Create a system message with context
    const systemMessage = context 
      ? `You are an AI assistant with access to relevant context. Use this context to inform your responses:\n\n${context}`
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
  } catch (error) {
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
