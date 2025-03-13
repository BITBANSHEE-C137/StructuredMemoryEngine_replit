import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { APP_NAME } from '@/lib/constants';

export default function Login() {
  // Function to handle login with Replit Auth
  const handleLogin = () => {
    // Replit Auth uses the /api/auth/login endpoint to authenticate users
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
      <div className="w-full max-w-md px-4">
        <Card className="w-full shadow-lg border-slate-700">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg 
                    viewBox="0 0 100 100" 
                    className="w-full h-full text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="4" />
                    <circle cx="30" cy="40" r="8" fill="currentColor" className="animate-pulse" />
                    <circle cx="70" cy="40" r="8" fill="currentColor" className="animate-pulse delay-200" />
                    <circle cx="50" cy="70" r="8" fill="currentColor" className="animate-pulse delay-500" />
                    <path d="M30 40 L70 40" stroke="currentColor" strokeWidth="2" />
                    <path d="M30 40 L50 70" stroke="currentColor" strokeWidth="2" />
                    <path d="M70 40 L50 70" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{APP_NAME}</CardTitle>
            <CardDescription className="text-slate-400">
              Your context-aware RAG system with intelligent memory management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-slate-300 bg-slate-800/50 rounded-lg p-4">
              <p>Please sign in with your Replit account to access the Structured Memory Engine.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleLogin} 
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              Sign in with Replit
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}