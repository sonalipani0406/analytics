"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    // Initialize Google Sign-In
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GCP_CLIENT_ID || "",
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button")!,
        {
          theme: "outline",
          size: "large",
          text: "signin_with",
          width: "200",
        }
      );
    }
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
          <div id="google-signin-button" className="flex justify-center" />

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <p>Only @rbg.iitm.ac.in email addresses are allowed to access this dashboard.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
