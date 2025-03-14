import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, LogIn } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  console.log("NotFound component rendering");
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
            <p className="mt-4 text-gray-600">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4 pt-2 pb-6">
          <Button asChild variant="outline">
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Link>
          </Button>
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
