"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type AppUser = { [k: string]: any };

interface FiltersState {
  start_date_filter?: string;
  end_date_filter?: string;
  [key: string]: string | undefined;
}

interface DistrictsProps {
  selectedSite?: string;
  selectedPeriod?: "day" | "week" | "month" | "custom";
  filters?: FiltersState;
}

// ── App registry — add more entries here as new apps come online ───────────
const APP_OPTIONS = [
  { value: "fps", label: "FPS App" },
  // { value: "otherapp", label: "Other App" },
];

// ── Resolve field value with multiple possible key names ──────────────────
function getField(user: AppUser, ...keys: string[]): string {
  for (const k of keys) {
    if (user[k] !== undefined && user[k] !== null && user[k] !== "") return String(user[k]);
  }
  return "—";
}

export default function Districts({
  selectedPeriod = "day",
  filters = {},
}: DistrictsProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [selectedApp, setSelectedApp] = useState("fps");
  const [appUsers, setAppUsers]       = useState<AppUser[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ── Local search/filter inputs ─────────────────────────────────────────
  const [nameSearch,     setNameSearch]     = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [psSearch,       setPsSearch]       = useState("");

  // ── Fetch from external API via backend proxy ──────────────────────────
  // Re-runs whenever the app, period, or custom date range changes.
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("app", selectedApp);
        params.set("period", selectedPeriod);
        // Custom date range overrides the period on the backend
        if (filters.start_date_filter) params.set("start_date", filters.start_date_filter);
        if (filters.end_date_filter)   params.set("end_date",   filters.end_date_filter);

        const res = await fetch(`/api/app-users?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Normalise: accept plain array, {users:[]}, {data:[]}, {results:[]}
        const list: AppUser[] = Array.isArray(json)
          ? json
          : (json.users ?? json.data ?? json.results ?? []);
        setAppUsers(list);
      } catch (e: any) {
        setError(e.message);
        setAppUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [selectedApp, selectedPeriod, filters.start_date_filter, filters.end_date_filter]);

  // ── Client-side filtering on the fetched rows ──────────────────────────
  const filteredUsers = useMemo(() => {
    return appUsers.filter((u) => {
      const name = getField(u, "user_name", "name", "username").toLowerCase();
      const district = getField(u, "district").toLowerCase();
      const ps = getField(u, "police_station", "ps", "policeStation", "police_station_name").toLowerCase();
      if (nameSearch && !name.includes(nameSearch.toLowerCase())) return false;
      if (districtSearch && !district.includes(districtSearch.toLowerCase())) return false;
      if (psSearch && !ps.includes(psSearch.toLowerCase())) return false;
      return true;
    });
  }, [appUsers, nameSearch, districtSearch, psSearch]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>App Users</CardTitle>
          {/* App selector — extend APP_OPTIONS to add more apps */}
          <div className="w-44">
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger>
                <SelectValue placeholder="Select app" />
              </SelectTrigger>
              <SelectContent>
                {APP_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* ── Row-level search filters ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <Label className="text-xs mb-1 block">Search by Name</Label>
            <Input
              placeholder="User name…"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Filter by District</Label>
            <Input
              placeholder="District…"
              value={districtSearch}
              onChange={(e) => setDistrictSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Filter by Police Station</Label>
            <Input
              placeholder="Police station…"
              value={psSearch}
              onChange={(e) => setPsSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Status ── */}
        {loading && (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading users…</div>
        )}
        {!loading && error && (
          <div className="text-sm text-destructive py-2">Error: {error}</div>
        )}

        {/* ── Table ── */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-2 font-semibold">#</th>
                  <th className="px-4 py-2 font-semibold">User Name</th>
                  <th className="px-4 py-2 font-semibold">User Role</th>
                  <th className="px-4 py-2 font-semibold">District</th>
                  <th className="px-4 py-2 font-semibold">Police Station</th>
                  <th className="px-4 py-2 font-semibold">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {appUsers.length === 0
                        ? "No user data available for the selected period."
                        : "No users match the current filters."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">
                        {getField(u, "user_name", "name", "username")}
                      </td>
                      <td className="px-4 py-2">
                        {getField(u, "user_role", "role")}
                      </td>
                      <td className="px-4 py-2">
                        {getField(u, "district")}
                      </td>
                      <td className="px-4 py-2">
                        {getField(u, "police_station", "ps", "policeStation", "police_station_name")}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {getField(u, "last_login", "last_seen", "lastLogin", "last_active")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2 text-right">
            Showing {filteredUsers.length} of {appUsers.length} users
          </div>
        )}
      </CardContent>
    </Card>
  );
}
