"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === "/login") {
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");

      if (!token) {
        setIsAuthenticated(false);
        router.push("/login");
        return;
      }

      try {
        // Verify token with backend
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
          setIsAuthenticated(false);
          router.push("/login");
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        setIsAuthenticated(false);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router, pathname]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null; // Router will redirect
  }

  return <>{children}</>;
}
