/**
 * Test Data Generator for Structured Memory Engine
 * 
 * This script generates test data with controlled duplication rates
 * to validate deduplication mechanisms in both the local database
 * and Pinecone vector database.
 * 
 * Features:
 * - Creates 200 random conversations (prompt/response pairs)
 * - Maintains a 13% duplication rate
 * - Generated data has realistic variation in content
 * - Includes metadata for tracking
 * 
 * Usage:
 * 1. Run with Node.js: node scripts/generate_test_data.js
 * 2. The script inserts data directly into the database
 */

import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;

// Database configuration - reads from environment variables
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Conversation topics for generating realistic data
const topics = [
  'machine learning', 'computer vision', 'natural language processing',
  'vector databases', 'neural networks', 'reinforcement learning',
  'semantic search', 'knowledge graphs', 'embedding models',
  'transformer architecture', 'attention mechanisms', 'fine-tuning'
];

// Question templates to simulate user prompts
const questionTemplates = [
  'Can you explain {topic} in simple terms?',
  'What are the best resources to learn about {topic}?',
  'How does {topic} compare to {topic2}?',
  'What are the latest advancements in {topic}?',
  'What are the practical applications of {topic}?',
  'How can I implement {topic} in my project?',
  'What are the limitations of {topic}?',
  'How do you evaluate performance in {topic} systems?',
  'Why is {topic} important for AI development?',
  'What tools would you recommend for working with {topic}?'
];

// Response templates to simulate AI responses
const responseTemplates = [
  "Here's an explanation of {topic}: {topic} refers to {explanation}. It's commonly used in {application}.",
  "The best resources for learning {topic} include books like '{book1}' and '{book2}', along with online courses from {platform}.",
  "When comparing {topic} with {topic2}, the main differences are {difference1} and {difference2}. {topic} is better for {advantage1}, while {topic2} excels at {advantage2}.",
  "Recent advancements in {topic} include {advancement1}, which has improved {metric1} by {percentage}%. Researchers at {organization} have also developed {advancement2}.",
  "Practical applications of {topic} include {application1}, {application2}, and {application3}. Industries like {industry1} and {industry2} have seen significant benefits.",
  "To implement {topic} in your project, start by {step1}, then {step2}. Popular libraries include {library1} and {library2}.",
  "The main limitations of {topic} are {limitation1} and {limitation2}. Researchers are working to address these by {approach}.",
  "Performance evaluation in {topic} typically uses metrics like {metric1}, {metric2}, and {metric3}. Benchmark datasets include {dataset1} and {dataset2}.",
  "{topic} is crucial for AI development because it enables {capability1} and {capability2}, which are fundamental to {application}.",
  "For working with {topic}, I recommend tools like {tool1}, {tool2}, and frameworks such as {framework1}. {tool1} is particularly good for {advantage1}."
];

// Fill-in content for template placeholders
const explanations = [
  "a technique for training computers to recognize patterns in data",
  "an approach to creating algorithms that can learn from experience",
  "a method for structuring information to enable efficient retrieval",
  "a system for representing semantic relationships between concepts",
  "a framework for developing models that can understand context"
];

const applications = [
  "recommendation systems", "autonomous vehicles", "content moderation",
  "healthcare diagnostics", "financial forecasting", "language translation",
  "fraud detection", "personalization", "information retrieval"
];

const books = [
  "Pattern Recognition and Machine Learning", "Deep Learning", 
  "Artificial Intelligence: A Modern Approach", "The Hundred-Page Machine Learning Book",
  "Speech and Language Processing", "Introduction to Information Retrieval",
  "Reinforcement Learning: An Introduction", "Hands-On Machine Learning",
  "Natural Language Processing with Transformers", "Neural Network Methods for NLP"
];

const platforms = [
  "Coursera", "edX", "Udacity", "Fast.ai", "DeepLearning.AI",
  "MIT OpenCourseWare", "Stanford Online", "Google AI"
];

const advantages = [
  "handling sparse data", "processing sequential information",
  "scaling to large datasets", "transfer learning capabilities",
  "interpretability", "computational efficiency", "handling multimodal data"
];

const advancements = [
  "multi-head attention mechanisms", "zero-shot learning techniques",
  "sparse representation models", "contrastive learning frameworks",
  "multitask learning architectures", "prompt engineering methods",
  "differential privacy approaches", "knowledge distillation techniques"
];

const organizations = [
  "OpenAI", "Google DeepMind", "Meta AI Research", "Microsoft Research",
  "Stanford AI Lab", "MIT CSAIL", "Carnegie Mellon University", "Allen AI Institute"
];

const metrics = [
  "accuracy", "precision", "recall", "F1 score", 
  "AUC-ROC", "mean average precision", "perplexity", "BLEU score",
  "throughput", "latency", "inference time", "memory consumption"
];

const datasets = [
  "ImageNet", "COCO", "SQuAD", "GLUE", "SuperGLUE", 
  "MS MARCO", "Common Crawl", "WikiText", "MNIST", "CIFAR-10"
];

const limitations = [
  "high computational requirements", "lack of interpretability",
  "insufficient training data", "difficulty generalizing across domains",
  "sensitivity to adversarial examples", "bias in training data",
  "poor performance on long-tail distributions", "limited causal reasoning"
];

const approaches = [
  "developing more efficient architectures", "creating better benchmarks",
  "improving interpretability methods", "collecting more diverse datasets",
  "incorporating human feedback", "enhancing few-shot learning techniques"
];

const capabilities = [
  "abstract reasoning", "pattern recognition", "knowledge transfer",
  "contextual understanding", "compositional learning", "multimodal integration"
];

const tools = [
  "TensorFlow", "PyTorch", "Hugging Face Transformers", "spaCy",
  "NLTK", "scikit-learn", "Keras", "OpenCV", "Pandas", "JAX"
];

const frameworks = [
  "Ray", "Apache Spark", "MLflow", "Weights & Biases", "DVC",
  "FastAPI", "Streamlit", "Gradio", "OpenNMT", "Fairseq"
];

// Function to randomly select an item from an array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Function to replace placeholders in templates
function fillTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
}

// Generate a single conversation (prompt and response)
function generateConversation() {
  const mainTopic = getRandomItem(topics);
  let secondTopic;
  do {
    secondTopic = getRandomItem(topics);
  } while (secondTopic === mainTopic);

  const questionTemplate = getRandomItem(questionTemplates);
  const responseTemplate = getRandomItem(responseTemplates);

  const templateData = {
    topic: mainTopic,
    topic2: secondTopic,
    explanation: getRandomItem(explanations),
    application: getRandomItem(applications),
    application1: getRandomItem(applications),
    application2: getRandomItem(applications),
    application3: getRandomItem(applications),
    book1: getRandomItem(books),
    book2: getRandomItem(books),
    platform: getRandomItem(platforms),
    difference1: `differences in ${getRandomItem(advantages)}`,
    difference2: `variations in ${getRandomItem(advantages)}`,
    advantage1: getRandomItem(advantages),
    advantage2: getRandomItem(advantages),
    advancement1: getRandomItem(advancements),
    advancement2: getRandomItem(advancements),
    metric1: getRandomItem(metrics),
    metric2: getRandomItem(metrics),
    metric3: getRandomItem(metrics),
    percentage: Math.floor(Math.random() * 30) + 10, // 10-40% improvement
    organization: getRandomItem(organizations),
    industry1: getRandomItem(applications),
    industry2: getRandomItem(applications),
    step1: `setting up your ${getRandomItem(frameworks)} environment`,
    step2: `implementing the core ${mainTopic} components`,
    library1: getRandomItem(tools),
    library2: getRandomItem(tools),
    limitation1: getRandomItem(limitations),
    limitation2: getRandomItem(limitations),
    approach: getRandomItem(approaches),
    dataset1: getRandomItem(datasets),
    dataset2: getRandomItem(datasets),
    capability1: getRandomItem(capabilities),
    capability2: getRandomItem(capabilities),
    tool1: getRandomItem(tools),
    tool2: getRandomItem(tools),
    framework1: getRandomItem(frameworks)
  };

  const prompt = fillTemplate(questionTemplate, templateData);
  const response = fillTemplate(responseTemplate, templateData);

  return { prompt, response };
}

// Generate a unique ID for memories to facilitate deduplication tracking
function generateMemoryId(content, type, messageId) {
  const hash = crypto.createHash('sha256');
  hash.update(`${content}|${type}|${messageId}`);
  return hash.digest('hex');
}

// Main function to generate and insert test data
async function generateAndInsertTestData() {
  const TOTAL_CONVERSATIONS = 10; // Reduced for fast execution
  const DUPLICATION_RATE = 0.13; // 13% duplication
  
  // Connect to the database
  const client = new Client(dbConfig);
  await client.connect();
  console.log('Connected to database');
  
  try {
    // First, clear existing test data
    console.log('Clearing existing test data...');
    await client.query("DELETE FROM memories WHERE metadata->>'source' = 'test_generator'");
    await client.query("DELETE FROM messages WHERE content LIKE '%[Test Data]%'");
    
    // Generate original conversations
    const originalCount = Math.floor(TOTAL_CONVERSATIONS * (1 - DUPLICATION_RATE));
    const duplicateCount = TOTAL_CONVERSATIONS - originalCount;
    
    console.log(`Generating ${originalCount} original conversations and ${duplicateCount} duplicates...`);
    
    const conversations = [];
    for (let i = 0; i < originalCount; i++) {
      conversations.push(generateConversation());
    }
    
    // Create duplicates by copying random conversations
    const duplicates = [];
    for (let i = 0; i < duplicateCount; i++) {
      // Pick a random conversation to duplicate
      const sourceIdx = Math.floor(Math.random() * originalCount);
      duplicates.push(conversations[sourceIdx]);
    }
    
    // Combine original and duplicates
    const allConversations = [...conversations, ...duplicates];
    
    // Shuffle to distribute duplicates throughout the dataset
    for (let i = allConversations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allConversations[i], allConversations[j]] = [allConversations[j], allConversations[i]];
    }
    
    // Insert messages and memories
    console.log('Inserting test data into database...');
    
    let insertedMessages = 0;
    let insertedMemories = 0;
    
    for (const [idx, conversation] of allConversations.entries()) {
      // Insert user message
      const userMessageResult = await client.query(
        'INSERT INTO messages (content, role, timestamp, model_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [`[Test Data] ${conversation.prompt}`, 'user', new Date(), 'gpt-4o']
      );
      const userMessageId = userMessageResult.rows[0].id;
      
      // Insert user memory
      const userMemoryId = generateMemoryId(conversation.prompt, 'prompt', userMessageId);
      await client.query(
        `INSERT INTO memories (content, embedding, type, message_id, timestamp, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          conversation.prompt,
          JSON.stringify(Array(1536).fill(0).map(() => (Math.random() - 0.5) * 0.01)), // Proper dimension random embedding
          'prompt',
          userMessageId,
          new Date(),
          JSON.stringify({
            source: 'test_generator', 
            index: idx,
            memory_id: userMemoryId,
            is_duplicate: idx >= originalCount
          })
        ]
      );
      insertedMemories++;
      
      // Insert assistant message
      const assistantMessageResult = await client.query(
        'INSERT INTO messages (content, role, timestamp, model_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [`[Test Data] ${conversation.response}`, 'assistant', new Date(), 'gpt-4o']
      );
      const assistantMessageId = assistantMessageResult.rows[0].id;
      
      // Insert assistant memory
      const assistantMemoryId = generateMemoryId(conversation.response, 'response', assistantMessageId);
      await client.query(
        `INSERT INTO memories (content, embedding, type, message_id, timestamp, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          conversation.response,
          JSON.stringify(Array(1536).fill(0).map(() => (Math.random() - 0.5) * 0.01)), // Proper dimension random embedding
          'response',
          assistantMessageId,
          new Date(),
          JSON.stringify({
            source: 'test_generator',
            index: idx,
            memory_id: assistantMemoryId,
            is_duplicate: idx >= originalCount
          })
        ]
      );
      insertedMemories++;
      insertedMessages += 2;
      
      // Progress indicator
      if (idx % 10 === 0) {
        console.log(`Progress: ${Math.round((idx / allConversations.length) * 100)}%`);
      }
    }
    
    console.log(`Successfully inserted ${insertedMessages} messages and ${insertedMemories} memories`);
    console.log(`Expected duplication rate: ${DUPLICATION_RATE * 100}%`);
    
  } catch (error) {
    console.error('Error inserting test data:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Execute the function
generateAndInsertTestData().catch(console.error);

// Export for potential imports from other modules
export { generateAndInsertTestData };