
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem("userData");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = async () => {
    try {
      // Call logout endpoint
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local storage
      localStorage.removeItem("authToken");
      localStorage.removeItem("userData");
      // Redirect to login
      router.push("/login");
    }
  };

  return (
    <header className="bg-secondary border-b p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Analytics Dashboard
            <Badge>Live</Badge>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs max-w-xs truncate">
                    {user.name || user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
