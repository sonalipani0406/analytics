
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Filter, RotateCw, Search } from "lucide-react";

export interface FiltersProps {
  onFiltersChange: (filters: {
    country_filter: string;
    device_filter: string;
    browser_filter: string;
    visitor_type_filter: string;
    start_date_filter: string;
    end_date_filter: string;
  }) => void;
  meta: {
    distinct_countries: string[];
    distinct_devices: string[];
    distinct_browsers: string[];
  };
  isCustomPeriod?: boolean;
}

export function Filters({ onFiltersChange, meta, isCustomPeriod = false }: FiltersProps) {
  const [country, setCountry] = useState("all");
  const [device, setDevice] = useState("all");
  const [browser, setBrowser] = useState("all");
  const [visitorType, setVisitorType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleApply = () => {
    onFiltersChange({
      country_filter: country === "all" ? "" : country,
      device_filter: device === "all" ? "" : device,
      browser_filter: browser === "all" ? "" : browser,
      visitor_type_filter: visitorType,
      start_date_filter: startDate,
      end_date_filter: endDate,
    });
  };

  const handleReset = () => {
    setCountry("all");
    setDevice("all");
    setBrowser("all");
    setVisitorType("all");
    setStartDate("");
    setEndDate("");

    onFiltersChange({
      country_filter: "",
      device_filter: "",
      browser_filter: "",
      visitor_type_filter: "",
      start_date_filter: "",
      end_date_filter: "",
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  return (
    <Card className="mb-4 md:mb-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Advanced Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
          <div className="grid gap-2">
            <Label htmlFor="countryFilter">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="countryFilter">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {meta?.distinct_countries?.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deviceFilter">Device Type</Label>
            <Select value={device} onValueChange={setDevice}>
              <SelectTrigger id="deviceFilter">
                <SelectValue placeholder="All Devices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {meta?.distinct_devices?.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="browserFilter">Browser</Label>
            <Select value={browser} onValueChange={setBrowser}>
              <SelectTrigger id="browserFilter">
                <SelectValue placeholder="All Browsers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Browsers</SelectItem>
                {meta?.distinct_browsers?.map((b: string) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="visitorTypeFilter">Visitor Type</Label>
            <Select value={visitorType} onValueChange={setVisitorType}>
              <SelectTrigger id="visitorTypeFilter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visitors</SelectItem>
                <SelectItem value="unique">Unique Only</SelectItem>
                <SelectItem value="repeated">Returning Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isCustomPeriod && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="startDateFilter">Start Date</Label>
                <Input type="date" id="startDateFilter" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDateFilter">End Date</Label>
                <Input type="date" id="endDateFilter" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCw className="h-4 w-4 mr-2" /> Reset Filters
          </Button>
          <Button onClick={handleApply}>
            <Search className="h-4 w-4 mr-2" /> Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
