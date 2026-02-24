"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Initialize Google Sign-In with hardcoded Client ID
    const initializeGoogleSignIn = () => {
      const clientId = "753011261618-k46db0seqt8d5m0lljb14378ogrium9f.apps.googleusercontent.com"; // Hardcoded Client ID
      
      if (!window.google || !window.google.accounts) {
        // Retry after a short delay if Google not ready
        setTimeout(initializeGoogleSignIn, 200);
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        const buttonContainer = document.getElementById("google-signin-button");
        if (buttonContainer) {
          window.google.accounts.id.renderButton(buttonContainer, {
            theme: "outline",
            size: "large",
            text: "signin_with",
            width: "280",
          });
        }
      } catch (err) {
        console.error("Google Sign-In initialization error:", err);
      }
    };

    initializeGoogleSignIn();
  }, []);

  const handleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    setError(null);

    try {
      // Send token to backend
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: response.credential,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Authentication failed");
        setIsLoading(false);
        return;
      }

      // Store JWT token in localStorage
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userData", JSON.stringify(data.user));

      // Redirect to dashboard
      router.push("/");
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error("Login error:", err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold">Analytics Dashboard</CardTitle>
          <CardDescription>
            Sign in with your @rbg.iitm.ac.in email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div id="google-signin-button" className="flex justify-center min-h-[50px]" />

          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded flex gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Sign-in Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Signing in...</p>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p><strong>Access Policy:</strong></p>
            <p className="mt-1">Only @rbg.iitm.ac.in email addresses are allowed to access this dashboard.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
