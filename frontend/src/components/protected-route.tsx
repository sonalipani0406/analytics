"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");
      
      // If on login page, allow access regardless of auth
      if (pathname === "/login") {
        setIsReady(true);
        setIsAuthenticated(false); // Don't mark as authenticated on login page
        return;
      }

      // For other pages, require authentication
      if (!token) {
        // No token - redirect to login
        router.push("/login");
        return;
      }

      try {
        // Verify token is still valid
        const response = await fetch("/api/auth/verify", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Token invalid or expired
          localStorage.removeItem("authToken");
          localStorage.removeItem("userData");
          router.push("/login");
          return;
        }

        // Token is valid
        setIsAuthenticated(true);
        setIsReady(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        router.push("/login");
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If on login page, always show it
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // For dashboard pages, only show if authenticated
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Should not reach here due to redirect, but just in case
  return null;
}
