import React, { useEffect } from "react";
import { Switch, Route, useLocation, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import { useAuth } from "@/hooks/useAuth";

// AuthGuard component for protected routes
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isOnLoginPage] = useRoute("/login");
  
  // Use useEffect for navigation to avoid React warning about setState during render
  useEffect(() => {
    // Don't redirect during loading
    if (isLoading) return;
    
    // Redirect to login if not authenticated and not already on login page
    if (!isAuthenticated && !isOnLoginPage) {
      navigate("/login");
    }
    
    // Redirect to home if authenticated and on login page
    if (isAuthenticated && isOnLoginPage) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, isOnLoginPage, navigate]);
  
  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // For login page, render when auth is loading or when authenticated is false
  if (isOnLoginPage) {
    return isAuthenticated ? null : <>{children}</>;
  }
  
  // For protected pages, render when auth is loading or when authenticated is true
  return isAuthenticated ? <>{children}</> : null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/" component={Home} />
          <Route component={NotFound} />
        </Switch>
      </AuthGuard>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
