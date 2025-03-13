import { Request, Response, NextFunction } from 'express';
import { getUserInfo } from '@replit/repl-auth';

// Extend the Express Request type to include a user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        roles: string[];
        bio?: string;
        url?: string;
        profileImage?: string;
      };
    }
  }
}

// Authentication middleware to protect routes
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get the user from the request
  const user = getUserInfo(req);
  
  // If there's no user, they're not authenticated
  if (!user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource' 
    });
  }
  
  // Add the user to the request object for later use
  req.user = user;
  
  // Continue to the next middleware or route handler
  next();
}

// Authentication check function (non-middleware)
export function isAuthenticated(req: Request): boolean {
  const user = getUserInfo(req);
  return !!user;
}

// Get current user information
export function getCurrentUser(req: Request) {
  return getUserInfo(req);
}