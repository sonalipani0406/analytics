
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { CityDistributionChart, TopPagesChart } from "@/components/charts";
import Districts from "@/components/districts";
import { VisitorsTable, Visitor } from "@/components/visitors-table";
import { TrafficTimelineData } from "@/components/traffic-timeline-chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StatsGridProps } from "@/components/stats-cards";
import { FiltersProps } from "@/components/filters";
import { AuthSession, getStoredSession } from "@/lib/auth";

interface FiltersState {
  [key: string]: string;
}

interface AnalyticsData {
  stats: StatsGridProps["stats"];
  meta: FiltersProps["meta"];
  charts: {
    by_date: TrafficTimelineData[];
    by_week: TrafficTimelineData[];
    by_month: TrafficTimelineData[];
    by_country: any[];
    by_city: any[];
    by_page: any[];
    by_device: any[];
    by_browser: any[];
  };
  visitor_list: Visitor[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [filters, setFilters] = useState<FiltersState>({});
  const [activeTab, setActiveTab] = useState("districts");

  useEffect(() => {
    const currentSession = getStoredSession();

    if (!currentSession) {
      // TODO: login temporarily disabled
      // router.replace("/login");
      const bypassSession: AuthSession = {
        username: "vb",
        displayName: "Super Admin",
        role: "super_admin",
        allowedApps: ["fps", "tpl", "sanjaya"],
        loginAt: new Date().toISOString(),
      };
      setSession(bypassSession);
      setAuthReady(true);
      return;
    }

    setSession(currentSession);
    setAuthReady(true);
  }, [router]);

  const loadData = async (currentFilters: FiltersState) => {
    const cleanedFilters: { [key: string]: string } = {};
    for (const key in currentFilters) {
      if (currentFilters[key] && currentFilters[key] !== "all") {
        cleanedFilters[key] = currentFilters[key];
      }
    }

    // Add period to params
    cleanedFilters['period'] = 'day';
    
    // Add site filter
    cleanedFilters['site_filter'] = 'all';

    const params = new URLSearchParams(cleanedFilters);
    
    try {
      const response = await fetch(`/api/analytics?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error("Failed to load analytics data:", error);
    }
  };

  useEffect(() => {
    if (!authReady || !session) {
      return;
    }

    loadData(filters);
    const interval = setInterval(() => loadData(filters), 30000);
    return () => clearInterval(interval);
  }, [authReady, session, filters]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header session={session} />
      
      <main className="max-w-7xl mx-auto p-2 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="hidden md:block">
            <TabsList className="grid w-full grid-cols-4 text-xs">
              <TabsTrigger value="districts">User Table</TabsTrigger>
              <TabsTrigger value="city">City</TabsTrigger>
              <TabsTrigger value="pages">Top Pages</TabsTrigger>
              <TabsTrigger value="visitors">Visitors</TabsTrigger>
            </TabsList>
          </div>
          <div className="block md:hidden mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onSelect={() => setActiveTab("districts")}>User Table</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("city")}>City Distribution</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("pages")}>Top Pages</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("visitors")}>Recent Visitor Activity</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <TabsContent value="districts">
            <Districts
              canExport={session.role === "super_admin"}
              allowedApps={session.allowedApps}
            />
          </TabsContent>

          <TabsContent value="city">
            <CityDistributionChart data={data?.charts?.by_city || []} />
          </TabsContent>
          <TabsContent value="pages">
            <TopPagesChart data={data?.charts?.by_page || []} />
          </TabsContent>
          <TabsContent value="visitors">
            <VisitorsTable visitors={data?.visitor_list || []} />
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}
