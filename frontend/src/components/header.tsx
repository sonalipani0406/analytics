
"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { AuthSession, clearSession } from "@/lib/auth";

interface HeaderProps {
  session: AuthSession;
}

export function Header({ session }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.replace("/login");
  };

  return (
    <header className="bg-secondary border-b p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Analytics Dashboard
            <Badge>Live</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as <span className="font-medium text-foreground">{session.displayName}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">
            {session.role === "super_admin" ? "Super Admin" : "Admin"}
          </Badge>
          <ThemeToggle />
          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
