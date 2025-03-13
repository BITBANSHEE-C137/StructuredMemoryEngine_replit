# Structured Memory Engine

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A real-time context-aware RAG (Retrieval Augmented Generation) chatbot system that enables intelligent memory management through advanced semantic retrieval and AI-powered interactions.

## 🚀 Features

- **Vector-based Memory Storage**: Utilizes PostgreSQL with pgvector extension for efficient semantic similarity search
- **Multi-Provider AI Support**: Seamlessly integrates with both OpenAI and Anthropic models
- **Contextual Memory Retrieval**: Automatically retrieves relevant historical information during conversations
- **Customizable Settings**: Fine-tune memory relevance, context window size, and similarity thresholds
- **Real-time Embedding Visualization**: Visual representation of memory similarity and vector space
- **Modern UI/UX**: Clean, responsive interface with AppStack-inspired design system

## 📸 Screenshots

### Main Chat Interface
The main interface shows the chat interaction area with the memory system panel on the right. The system provides immediate context-aware responses based on conversation history.

![Main Interface](./screenshots/main-interface.png)

### Settings Configuration
The settings modal allows customization of AI providers, model selection, embedding parameters, and memory management options.

![Settings](./screenshots/settings.png)

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI components
- **Backend**: Express.js, Node.js 
- **Database**: PostgreSQL with pgvector extension for vector embedding storage
- **AI Integration**: OpenAI and Anthropic APIs for text generation and embeddings
- **State Management**: React Query, custom hooks

## 🏗️ Architecture

The application follows a modern client-server architecture:

1. **User Interface Layer**: React frontend with responsive design and real-time updates
2. **API Layer**: Express.js REST API endpoints for chat, memory operations, and settings
3. **Memory Management Layer**: Vector database operations for semantic storage and retrieval
4. **AI Integration Layer**: Provider-agnostic interface for multiple language models

## 🔧 Setup Requirements

- Node.js v18+ and npm 8+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key and/or Anthropic API key

## 🚦 Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/memory_engine
   OPENAI_API_KEY=your_openai_key
   ANTHROPIC_API_KEY=your_anthropic_key 
   ```
4. Initialize the database:
   ```
   npm run db:push
   ```
5. Start the development server:
   ```
   npm run dev
   ```

## 🧠 How It Works

1. **Memory Creation**: User queries and AI responses are embedded using vector models and stored in the database
2. **Contextual Retrieval**: When a new query is received, the system embeds it and searches for similar past memories
3. **Enhanced Generation**: The most relevant memories are included in the context for the AI, enabling more informed responses
4. **Continuous Learning**: As conversations progress, the memory database grows, improving contextual awareness

## 💡 Use Cases

- **Knowledge Base Assistants**: Create chatbots that learn from interactions and build domain knowledge
- **Customer Support**: Maintain context across multiple questions without repetition
- **Research Assistants**: Track complex discussions and reference previous findings
- **Personal Productivity**: Remember details from past conversations to provide more coherent assistance

## 🛣️ Roadmap

- [ ] Memory clustering and categorization
- [ ] Integration with Pinecone and other vector databases
- [ ] Fine-tuning capabilities for custom domain adaptation
- [ ] Advanced memory visualization tools
- [ ] User management and multi-tenant support

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.