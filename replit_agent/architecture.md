# Structured Memory Engine Architecture

## Overview

The Structured Memory Engine is a context-aware RAG (Retrieval Augmented Generation) chatbot system that uses vector embeddings to store and retrieve semantically relevant information during conversations. The application features real-time memory management, multi-provider AI support, and vector-based semantic search capabilities.

The system is designed as a modern full-stack application with a React frontend, Express.js backend, and a PostgreSQL database with pgvector extension for vector similarity search. It supports integration with both OpenAI and Anthropic AI providers, allowing users to choose between different language models for chat interactions.

## System Architecture

The application follows a client-server architecture with clear separation of concerns:

```
┌───────────────┐     ┌────────────────┐     ┌────────────────────────┐
│               │     │                │     │                        │
│  React        │     │  Express.js    │     │  PostgreSQL            │
│  Frontend     │◄────►  API Server    │◄────►  (with pgvector)       │
│               │     │                │     │                        │
└───────────────┘     └────────────────┘     └────────────────────────┘
                              │                          ▲
                              │                          │
                              ▼                          │
                      ┌───────────────┐                  │
                      │               │                  │
                      │  AI Provider  │                  │
                      │  Integration  │──────────────────┘
                      │               │ (store embeddings)
                      └───────────────┘
```

### Key Design Principles

1. **Modular Architecture**: The codebase is organized into distinct modules to maintain separation of concerns.
2. **API-First Design**: All interactions between frontend and backend happen through well-defined REST APIs.
3. **Provider Agnostic**: The system supports multiple AI providers (OpenAI, Anthropic) through a unified interface.
4. **Progressive Enhancement**: The memory system enhances the base chat functionality with semantic retrieval.
5. **Database-Driven State**: The application state is primarily stored in the database.

## Key Components

### Frontend Architecture

The frontend is built with React, TypeScript, and TailwindCSS using the following structure:

- **UI Components**: Built with Shadcn UI components based on Radix UI primitives
- **State Management**: Uses React Query for server state management and custom hooks for local state
- **Routing**: Simple client-side routing with Wouter
- **Authentication**: Integrates with Replit Auth for user authentication

Key frontend directories:
- `/client/src/components`: UI components including chat interface and memory panel
- `/client/src/lib`: Utility functions, types, and hooks
- `/client/src/pages`: Main application pages
- `/client/src/hooks`: Custom React hooks for various functionalities

### Backend Architecture

The backend is built with Express.js and Node.js using the following structure:

- **API Routes**: RESTful endpoints for chat, memory operations, and settings
- **Database Layer**: Drizzle ORM for type-safe database operations
- **AI Integration**: Service adapters for OpenAI and Anthropic
- **Authentication**: Middleware for Replit Auth integration

Key backend directories:
- `/server`: Contains all server-side code
- `/server/routes`: API route definitions
- `/server/utils`: Utility functions for AI providers and other services
- `/server/middleware`: Express middleware functions

### Database Schema

The application uses PostgreSQL with the pgvector extension for vector similarity search. Key tables include:

1. **users**: Stores user authentication information
2. **messages**: Stores chat messages between users and the AI
3. **memories**: Stores vector embeddings of messages for semantic retrieval
4. **settings**: Stores application settings
5. **models**: Stores available AI models configuration

The database schema uses Drizzle ORM with the following key relationships:
- Messages are associated with users
- Memories are associated with messages
- Settings control the behavior of the memory retrieval system

### Authentication & Authorization

The application uses Replit Auth for authentication:

1. User authentication is handled via the `/api/auth` endpoints
2. Authentication state is stored in cookies
3. Protected routes use middleware to verify authentication status
4. User info is retrieved via the Replit Auth API

## Data Flow

### Chat Interaction Flow

1. User sends a message via the chat interface
2. The message is sent to the server via the `/api/chat` endpoint
3. The server processes the message:
   - Stores the user message in the database
   - Generates a vector embedding for the message
   - Searches for semantically similar memories
   - Retrieves relevant context based on similarity
   - Sends the augmented prompt to the selected AI provider
4. The AI provider generates a response
5. The server stores the response and its embedding
6. The response is returned to the client along with relevant memory information
7. The client displays the response and updates the memory panel

### Memory Retrieval Flow

1. When a new message is received, the system:
   - Converts the message to a vector embedding
   - Performs a similarity search using pgvector
   - Retrieves memories above the configured similarity threshold
   - Ranks and limits the memories based on settings
2. The retrieved memories are used to augment the AI prompt
3. The response is generated with the context of relevant memories

## External Dependencies

### AI Provider Integrations

1. **OpenAI Integration**:
   - Uses the OpenAI API for chat completions and embeddings
   - Supports the latest models like GPT-4o
   - Handles rate limiting and error handling

2. **Anthropic Integration**:
   - Uses the Anthropic API for Claude model interactions
   - Supports the latest Claude models
   - Provides fallback if OpenAI is unavailable

### Vector Database Extension

The application uses pgvector for PostgreSQL to enable vector similarity search:

1. Stores message embeddings as 1536-dimensional vectors
2. Supports similarity search using cosine similarity 
3. Enables efficient retrieval of semantically similar content

### Optional Pinecone Integration

The system includes optional integration with Pinecone for vector search:

1. Can sync local vector embeddings to Pinecone
2. Allows for more advanced vector search capabilities
3. Provides potential scalability advantages for large memory stores

## Deployment Strategy

The application is designed to be deployable on various platforms, with specific support for Replit:

1. **Development Environment**:
   - Uses Vite for development server
   - Hot module reloading for faster development
   - Environment variables for configuration

2. **Production Deployment**:
   - Static assets are built with Vite
   - Server is bundled with esbuild
   - Both frontend and backend are served from a single Express app

3. **Database Management**:
   - Uses Drizzle migrations for schema updates
   - Includes schema validation with Zod
   - Initial database seeding for models

4. **Environment Configuration**:
   - Uses environment variables for sensitive values
   - Includes Replit-specific configuration
   - Supports CloudRun deployment via Replit

## Security Considerations

1. **Authentication**: Relies on Replit Auth for secure user authentication
2. **API Keys**: All AI provider API keys are stored as environment variables
3. **Database Security**: Uses parameterized queries to prevent SQL injection
4. **CORS**: API endpoints are protected from cross-origin requests
5. **Error Handling**: Sanitizes error responses to prevent information leakage

## Future Extensibility

The architecture is designed to be extensible in several ways:

1. **Additional AI Providers**: The provider-agnostic design allows for easy integration of new AI services
2. **Enhanced Memory Management**: The vector storage system can be extended for more complex memory operations
3. **User Customization**: The settings system allows for user-specific configuration
4. **Advanced Vector Operations**: The system is ready for more complex vector operations like clustering or knowledge graph generation