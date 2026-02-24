
"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { StatsGrid } from "@/components/stats-cards";
import { Filters } from "@/components/filters";
import { AnalyticsChartsGrid, GlobalVisitorChart, CityDistributionChart, TopPagesChart } from "@/components/charts";
import { VisitorsTable, Visitor } from "@/components/visitors-table";
import { TrafficTimelineChart, TrafficTimelineData } from "@/components/traffic-timeline-chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatsGridProps } from "@/components/stats-cards";
import { FiltersProps } from "@/components/filters";

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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filters, setFilters] = useState<FiltersState>({});
  const [activeTab, setActiveTab] = useState("analytics");
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);

  // Load available sites on mount
  useEffect(() => {
    const loadSites = async () => {
      try {
        const response = await fetch('/api/sites');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSites(data.sites || []);
      } catch (error) {
        console.error("Failed to load sites:", error);
      }
    };
    loadSites();
  }, []);

  const loadData = async (currentFilters: FiltersState) => {
    const cleanedFilters: { [key: string]: string } = {};
    for (const key in currentFilters) {
      if (currentFilters[key] && currentFilters[key] !== "all") {
        cleanedFilters[key] = currentFilters[key];
      }
    }

    // Add period to params
    cleanedFilters['period'] = selectedPeriod;
    
    // Add site filter
    cleanedFilters['site_filter'] = selectedSite;

    const params = new URLSearchParams(cleanedFilters);
    try {
      const response = await fetch(`/api/analytics?${params.toString()}`);
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
    loadData(filters);
    const interval = setInterval(() => loadData(filters), 30000);
    return () => clearInterval(interval);
  }, [filters, selectedPeriod, selectedSite]);

  const handleFiltersChange = (newFilters: FiltersState) => {
    setFilters(newFilters);
  };

  const handlePeriodChange = (period: 'day' | 'week' | 'month' | 'custom') => {
    setSelectedPeriod(period);
  };

  const getTimelineData = () => {
    // Backend now returns dynamic resolution in 'by_date' (or we could have backend map it to correct key)
    // The Plan says: "Use this parameter dynamically in the GROUP BY and ORDER BY clauses: date_trunc(granularity, created_at)."
    // And backend returns 'by_date'.
    return data?.charts?.by_date || [];
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-7xl mx-auto p-2 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="w-full md:w-48">
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => handlePeriodChange('day')}
                className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${selectedPeriod === 'day' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                24H
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('week')}
                className={`px-4 py-2 text-sm font-medium border-t border-b ${selectedPeriod === 'week' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('month')}
                className={`px-4 py-2 text-sm font-medium border-t border-b ${selectedPeriod === 'month' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                30D
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('custom')}
                className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${selectedPeriod === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                Custom
              </button>
            </div>
          </div>
        </div>

        <StatsGrid stats={data?.stats || { total_visitors: 0, unique_visitors: 0, repeated_visitors: 0, avg_time_on_page: 0 }} />
        <Filters
          onFiltersChange={handleFiltersChange}
          meta={data?.meta || { distinct_countries: [], distinct_devices: [], distinct_browsers: [] }}
          isCustomPeriod={selectedPeriod === 'custom'}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="hidden md:block">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="timeline">Traffic Timeline</TabsTrigger>
              <TabsTrigger value="global">Global Visitor Distribution</TabsTrigger>
              <TabsTrigger value="city">City Distribution</TabsTrigger>
              <TabsTrigger value="pages">Top Pages</TabsTrigger>
              <TabsTrigger value="visitors">Recent Visitor Activity</TabsTrigger>
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
                <DropdownMenuItem onSelect={() => setActiveTab("analytics")}>Analytics</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("timeline")}>Traffic Timeline</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("global")}>Global Visitor Distribution</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("city")}>City Distribution</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("pages")}>Top Pages</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab("visitors")}>Recent Visitor Activity</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <TabsContent value="analytics">
            <AnalyticsChartsGrid chartsData={data?.charts || { by_device: [], by_browser: [] }} />
          </TabsContent>
          <TabsContent value="timeline">
            <TrafficTimelineChart data={getTimelineData()} granularity={selectedPeriod === 'day' ? 'hour' : 'day'} />
          </TabsContent>
          <TabsContent value="global">
            <GlobalVisitorChart data={data?.charts?.by_country || []} />
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
