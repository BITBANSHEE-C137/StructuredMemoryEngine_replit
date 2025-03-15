# Structured Memory Engine

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A real-time context-aware RAG (Retrieval Augmented Generation) chatbot system that enables intelligent memory management through advanced semantic retrieval and AI-powered interactions.

## 🚀 Features

- **Vector-based Memory Storage**: Utilizes PostgreSQL with pgvector extension for efficient semantic similarity search
- **Multi-Provider AI Support**: Seamlessly integrates with both OpenAI and Anthropic models
- **Contextual Memory Retrieval**: Automatically retrieves relevant historical information during conversations
- **Pinecone Integration**: Connect to Pinecone vector database for extended memory storage and retrieval
- **Customizable Settings**: Fine-tune memory relevance, context window size, and similarity thresholds
- **Real-time Memory Panel**: Interactive visualization of relevant memories for each conversation
- **Modern UI/UX**: Clean, responsive interface with focus on usability and continuous conversation

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
- **Vector Database**: Pinecone for scalable vector search and persistent memory
- **AI Integration**: OpenAI and Anthropic APIs for text generation and embeddings
- **State Management**: React Query, custom hooks

## 🏗️ Architecture

The application follows a modern client-server architecture:

1. **User Interface Layer**: React frontend with responsive design, focus management, and real-time updates
2. **API Layer**: Express.js REST API endpoints for chat, memory operations, and settings
3. **Memory Management Layer**: 
   - Local vector storage using PostgreSQL with pgvector
   - External vector storage via Pinecone integration for scaling and persistence
4. **AI Integration Layer**: Provider-agnostic interface for multiple language models (OpenAI, Anthropic)

## 🔧 Setup Requirements

- Node.js v18+ and npm 8+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key and/or Anthropic API key
- For authentication: Either Replit account (for Replit environment) or your own authentication system

### Replit-Specific Dependencies

This project was initially developed for the Replit platform and uses several Replit-specific features:

1. **Replit Auth**: The authentication system uses Replit's built-in OAuth service
2. **Replit Secrets**: Environment variables are stored in Replit's Secrets system
3. **Replit Database**: The PostgreSQL database is automatically configured by Replit

These features need to be reconfigured when deploying outside of Replit. See the deployment sections below for alternatives.

## 🚦 Getting Started

### Running on Replit

1. Fork this repository on Replit
2. Set up Replit Secrets (environment variables):
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `SESSION_SECRET`: A random string for session encryption
3. The PostgreSQL database will be automatically set up by Replit
4. Run the application using the Start button or the Replit Run command

### Running Outside Replit Environment

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
- [x] Integration with Pinecone vector database
- [x] Improved chat UX with focus management
- [ ] Fine-tuning capabilities for custom domain adaptation
- [ ] Advanced memory visualization tools
- [ ] User management and multi-tenant support
- [ ] Integration with additional vector databases

## 📜 License

## License and Attribution

This project is licensed under the MIT License - see the LICENSE file for details.