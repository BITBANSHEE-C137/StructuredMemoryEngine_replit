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

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables in a `.env` file:
   ```
   # Database configuration
   DATABASE_URL=postgresql://user:password@localhost:5432/memory_engine
   PGUSER=your_postgres_user
   PGPASSWORD=your_postgres_password
   PGDATABASE=memory_engine
   PGHOST=localhost
   PGPORT=5432
   
   # API Keys
   OPENAI_API_KEY=your_openai_key
   ANTHROPIC_API_KEY=your_anthropic_key 
   
   # Session configuration
   SESSION_SECRET=your_random_secret_string
   ```
4. Install and enable the pgvector extension in your PostgreSQL database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
5. Initialize the database:
   ```
   npm run db:push
   ```
6. Replace Replit authentication with your own auth system:
   - The application uses Replit's authentication service by default
   - To use your own authentication system:
     1. Modify `server/routes/auth.ts` to integrate with your preferred auth provider
     2. Update the login/logout endpoints to work with your authentication system
     3. Update `client/src/hooks/useAuth.ts` to match your authentication API responses
   - Alternatively, you can implement a simpler authentication method like:
     - JWT-based authentication with Passport.js
     - Auth0, Firebase Auth, or other authentication services
     - Basic username/password authentication for local development
   - Here's a simple example of a local development auth system in the [Authentication Guide](#authentication-guide)
7. Start the development server:
   ```
   npm run dev
   ```

## Authentication Guide

This project uses Replit Authentication by default, which is only available within the Replit platform. When running outside of Replit, you'll need to implement your own authentication system. Here's a basic example of implementing a simple authentication system:

1. Install required packages:
   ```
   npm install jsonwebtoken passport passport-local express-session
   ```

2. Create a new authentication middleware file at `server/middleware/local-auth.ts`:
   ```typescript
   import { Request, Response, NextFunction } from 'express';
   import jwt from 'jsonwebtoken';

   // Get JWT secret from environment variable
   const JWT_SECRET = process.env.SESSION_SECRET || 'your-fallback-secret';

   interface UserInfo {
     id: string;
     name: string;
     profileImage?: string;
   }

   // Extend the Express Request type to include a user property
   declare global {
     namespace Express {
       interface Request {
         user?: UserInfo;
       }
     }
   }

   // Verify JWT token from Authorization header
   export function authMiddleware(req: Request, res: Response, next: NextFunction) {
     // Get token from Authorization header
     const authHeader = req.headers.authorization;
     const token = authHeader && authHeader.split(' ')[1];
     
     if (!token) {
       return res.status(401).json({ 
         error: 'Unauthorized',
         message: 'No token provided' 
       });
     }
     
     try {
       // Verify token
       const user = jwt.verify(token, JWT_SECRET) as UserInfo;
       req.user = user;
       next();
     } catch (err) {
       return res.status(401).json({ 
         error: 'Unauthorized',
         message: 'Invalid token' 
       });
     }
   }

   // Check if user is authenticated
   export function isAuthenticated(req: Request): boolean {
     return !!req.user;
   }

   // Get current user
   export function getCurrentUser(req: Request): UserInfo | null {
     return req.user || null;
   }
   ```

3. Update your auth routes in `server/routes/auth.ts`:
   ```typescript
   import express from 'express';
   import jwt from 'jsonwebtoken';

   const router = express.Router();
   const JWT_SECRET = process.env.SESSION_SECRET || 'your-fallback-secret';

   // Sample users (in a real app, these would be in a database)
   const users = [
     { id: '1', username: 'user', password: 'password', name: 'Demo User' }
   ];

   // Login route
   router.post('/login', (req, res) => {
     const { username, password } = req.body;
     
     // Find user by username and password
     const user = users.find(u => u.username === username && u.password === password);
     
     if (!user) {
       return res.status(401).json({ error: 'Invalid credentials' });
     }
     
     // Create token
     const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
     
     res.json({ token });
   });

   // Get current user info
   router.get('/user', (req, res) => {
     // Auth middleware adds user to request if token is valid
     const authHeader = req.headers.authorization;
     const token = authHeader && authHeader.split(' ')[1];
     
     if (!token) {
       return res.json({ authenticated: false, user: null });
     }
     
     try {
       const user = jwt.verify(token, JWT_SECRET);
       return res.json({ authenticated: true, user });
     } catch (err) {
       return res.json({ authenticated: false, user: null });
     }
   });

   export default router;
   ```

4. Update your `client/src/hooks/useAuth.ts` file:
   ```typescript
   import { useQuery, useMutation } from "@tanstack/react-query";
   import { useState, useEffect } from "react";
   import { apiRequest } from "@/lib/queryClient";
   import { API_ROUTES } from "@/lib/constants";

   interface UserInfo {
     id: string;
     name: string;
     profileImage?: string;
   }

   interface AuthResponse {
     authenticated: boolean;
     user: UserInfo | null;
   }

   interface LoginCredentials {
     username: string;
     password: string;
   }

   export function useAuth() {
     // Get token from localStorage
     const [token, setToken] = useState<string | null>(
       typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
     );

     // Function to handle login
     const login = useMutation({
       mutationFn: async (credentials: LoginCredentials) => {
         const response = await apiRequest(API_ROUTES.AUTH.LOGIN, {
           method: 'POST',
           body: JSON.stringify(credentials),
           headers: {
             'Content-Type': 'application/json'
           }
         });
         return response.json();
       },
       onSuccess: (data) => {
         if (data.token) {
           localStorage.setItem('auth_token', data.token);
           setToken(data.token);
         }
       }
     });

     // Function to handle logout
     const logout = () => {
       localStorage.removeItem('auth_token');
       setToken(null);
     };

     // Get current user
     const { data, isLoading, error, refetch } = useQuery<AuthResponse>({
       queryKey: [API_ROUTES.AUTH.USER],
       queryFn: async () => {
         if (!token) return { authenticated: false, user: null };
         
         const response = await fetch(API_ROUTES.AUTH.USER, {
           headers: {
             'Authorization': `Bearer ${token}`
           }
         });
         return response.json();
       },
       enabled: !!token,
     });

     // Refresh auth when token changes
     useEffect(() => {
       if (token) {
         refetch();
       }
     }, [token, refetch]);

     return {
       isAuthenticated: !!data?.authenticated,
       user: data?.user || null,
       isLoading,
       error,
       login,
       logout,
     };
   }
   ```

This is a simplified example for local development. For production use, consider using established authentication services or frameworks.

## 🚀 Deployment Options

### Deploying on Replit

1. Fork this repository on Replit
2. Set up your environment variables in Replit Secrets
3. Click the "Run" button to start the application
4. Use the "Deploy" feature in Replit to make your app publicly accessible

### Deploying to Other Cloud Providers

#### Heroku

1. Create a new Heroku application
2. Add the PostgreSQL add-on with the pgvector extension
3. Configure environment variables in Heroku's settings
4. Deploy using Heroku Git or GitHub integration:
   ```
   heroku login
   heroku git:remote -a your-app-name
   git push heroku main
   ```

#### Vercel or Netlify (Frontend) + Railway/Render (Backend)

1. Split the deployment:
   - Deploy the frontend to Vercel/Netlify
   - Deploy the Express backend to Railway or Render
2. Set up your PostgreSQL database with pgvector on Railway or Render
3. Configure environment variables for both frontend and backend
4. Connect your frontend to the backend using the appropriate environment variables

#### Docker Deployment

1. Create a Dockerfile in the project root:
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm install
   
   COPY . .
   
   RUN npm run build
   
   EXPOSE 5000
   
   CMD ["npm", "start"]
   ```
2. Build and run the Docker image:
   ```
   docker build -t structured-memory-engine .
   docker run -p 5000:5000 --env-file .env structured-memory-engine
   ```
3. For the database, you can use a managed PostgreSQL service or run PostgreSQL in a separate container

### Environment Variable Configuration

When deploying, ensure the following environment variables are properly configured:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `PGUSER` | PostgreSQL username | `postgres` |
| `PGPASSWORD` | PostgreSQL password | `your_password` |
| `PGDATABASE` | PostgreSQL database name | `memory_engine` |
| `PGHOST` | PostgreSQL host | `localhost` |
| `PGPORT` | PostgreSQL port | `5432` |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | `sk-ant-...` |
| `PINECONE_API_KEY` | Your Pinecone API key | `abc123...` |
| `PINECONE_ENVIRONMENT` | Pinecone environment (region) | `us-east-1` |
| `SESSION_SECRET` | Secret for session encryption | `random_string` |

### Securing Your Deployment

1. Always use HTTPS in production
2. Store API keys and secrets securely using environment variables or a secrets manager
3. Implement rate limiting for API endpoints
4. Consider adding CORS configuration to restrict access to your backend
5. Regularly update dependencies to patch security vulnerabilities

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
- [x] Integration with Pinecone vector database
- [x] Improved chat UX with focus management
- [ ] Fine-tuning capabilities for custom domain adaptation
- [ ] Advanced memory visualization tools
- [ ] User management and multi-tenant support
- [ ] Integration with additional vector databases

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.