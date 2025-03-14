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
  const { isAuthenticated, isLoading, error } = useAuth();
  const [, navigate] = useLocation();
  const [isOnLoginPage] = useRoute("/login");
  const [isOnNotFoundPage] = useRoute("/:rest*");
  
  console.log("AuthGuard state:", { 
    isAuthenticated, 
    isLoading,
    hasError: !!error,
    isOnLoginPage,
    isOnNotFoundPage,
    currentPath: window.location.pathname
  });
  
  // Use useEffect for navigation to avoid React warning about setState during render
  useEffect(() => {
    // Don't redirect during loading
    if (isLoading) return;
    
    // Don't redirect for Not Found page
    if (isOnNotFoundPage && window.location.pathname !== "/") return;
    
    // Redirect to login if not authenticated and not already on login page
    if (!isAuthenticated && !isOnLoginPage) {
      console.log("Redirecting to login page");
      navigate("/login");
    }
    
    // Redirect to home if authenticated and on login page
    if (isAuthenticated && isOnLoginPage) {
      console.log("Redirecting to home page");
      navigate("/");
    }
  }, [isAuthenticated, isLoading, isOnLoginPage, isOnNotFoundPage, navigate]);
  
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
  console.log("App component rendering");
  const [location] = useLocation();
  
  console.log("Current location:", location);
  
  // Split routes into two categories based on whether they need auth
  // This helps avoid authentication circular redirects
  const isPublicRoute = location === "/login" || location.startsWith("/not-found");
  
  return (
    <QueryClientProvider client={queryClient}>
      {isPublicRoute ? (
        /* Public routes - Login and Not Found */
        <Switch>
          <Route path="/login" component={Login} />
          <Route component={NotFound} />
        </Switch>
      ) : (
        /* Protected routes - require authentication */
        <AuthGuard>
          <Switch>
            <Route path="/" component={Home} />
          </Switch>
        </AuthGuard>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
