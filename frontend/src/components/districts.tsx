"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type District = { name: string; count?: number; [k: string]: any };

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

// ── App registry (add more apps here) ─────────────────────────────────────
const APP_OPTIONS = [
  { value: "fps", label: "FPS App" },
  // { value: "myapp", label: "My App" },
];

// ── Field-name helpers ─────────────────────────────────────────────────────
function getField(user: AppUser, ...keys: string[]): string {
  for (const k of keys) {
    if (user[k] !== undefined && user[k] !== null && user[k] !== "") return String(user[k]);
  }
  return "—";
}

export default function Districts({
  selectedSite,
  selectedPeriod = "day",
  filters = {},
}: DistrictsProps) {
  // ── District-visitor state ───────────────────────────────────────────────
  const [states, setStates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [districtsByState, setDistrictsByState] = useState<Record<string, District[]>>({});
  const [loading, setLoading] = useState(false);

  // ── App-users state ──────────────────────────────────────────────────────
  const [selectedApp, setSelectedApp] = useState("fps");
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // ── Local table filters ──────────────────────────────────────────────────
  const [nameSearch, setNameSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [psSearch, setPsSearch] = useState("");

  // ── Load district-visitor data ───────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedSite) params.set("site_filter", selectedSite);
        const res = await fetch(`/api/districts?${params.toString()}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();

        const parseMap = (items: any[], stateKey = "state") => {
          const map: Record<string, District[]> = {};
          for (const d of items) {
            const s = d[stateKey] || d.region || "Unknown";
            map[s] = map[s] || [];
            map[s].push(d);
          }
          return map;
        };

        let map: Record<string, District[]> = {};
        if (json.by_state) {
          map = json.by_state;
        } else if (json.states && json.districts) {
          json.states.forEach((s: string) => (map[s] = []));
          json.districts.forEach((d: any) => {
            const s = d.state || d.region || "Unknown";
            map[s] = map[s] || [];
            map[s].push(d);
          });
        } else if (Array.isArray(json)) {
          map = parseMap(json);
        }

        setDistrictsByState(map);
        setStates(Object.keys(map));
        setSelectedState((prev) => prev || Object.keys(map)[0] || null);
      } catch (e) {
        console.error("Failed to load districts:", e);
        setDistrictsByState({});
        setStates([]);
        setSelectedState(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedSite]);

  // ── Load app-users whenever app / period / dates change ─────────────────
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const params = new URLSearchParams();
        params.set("app", selectedApp);
        params.set("period", selectedPeriod);
        if (filters.start_date_filter) params.set("start_date", filters.start_date_filter);
        if (filters.end_date_filter) params.set("end_date", filters.end_date_filter);

        const res = await fetch(`/api/app-users?${params.toString()}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();

        // Normalise: accept array, {users:[]}, {data:[]}, {results:[]}
        const list: AppUser[] = Array.isArray(json)
          ? json
          : json.users ?? json.data ?? json.results ?? [];
        setAppUsers(list);
      } catch (e: any) {
        setUsersError(e.message);
        setAppUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, [selectedApp, selectedPeriod, filters.start_date_filter, filters.end_date_filter]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const districtList = useMemo(
    () => (selectedState ? districtsByState[selectedState] || [] : []),
    [selectedState, districtsByState]
  );

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
    <div className="space-y-6">
      {/* ── District visitor counts (compact, no map) ── */}
      <Card>
        <CardHeader>
          <CardTitle>District Visitor Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 w-56">
            <Label className="text-xs font-bold uppercase tracking-wide text-primary mb-2 block">State</Label>
            <Select value={selectedState || ""} onValueChange={(v) => setSelectedState(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && districtList.length === 0 && (
            <div className="text-sm text-muted-foreground">No district data for selected state.</div>
          )}
          {!loading && districtList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {districtList.map((d, i) => (
                <div key={d.name + i} className="flex justify-between items-center p-2 border rounded text-sm">
                  <span className="font-medium truncate">{d.name}</span>
                  <span className="text-muted-foreground ml-2 shrink-0">{d.count ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── App Users Table ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>App Users</CardTitle>
            <div className="w-44">
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select app" />
                </SelectTrigger>
                <SelectContent>
                  {APP_OPTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <Label className="text-xs mb-1 block">Search by Name</Label>
              <Input placeholder="User name…" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Filter by District</Label>
              <Input placeholder="District…" value={districtSearch} onChange={(e) => setDistrictSearch(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Filter by Police Station</Label>
              <Input placeholder="Police station…" value={psSearch} onChange={(e) => setPsSearch(e.target.value)} />
            </div>
          </div>

          {/* Status messages */}
          {loadingUsers && <div className="text-sm text-muted-foreground py-4">Loading users…</div>}
          {!loadingUsers && usersError && (
            <div className="text-sm text-destructive py-2">Error: {usersError}</div>
          )}

          {/* Table */}
          {!loadingUsers && !usersError && (
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
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        {appUsers.length === 0 ? "No user data available." : "No users match the current filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2 font-medium">{getField(u, "user_name", "name", "username")}</td>
                        <td className="px-4 py-2">{getField(u, "user_role", "role")}</td>
                        <td className="px-4 py-2">{getField(u, "district")}</td>
                        <td className="px-4 py-2">{getField(u, "police_station", "ps", "policeStation", "police_station_name")}</td>
                        <td className="px-4 py-2 text-muted-foreground">{getField(u, "last_login", "last_seen", "lastLogin", "last_active")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loadingUsers && filteredUsers.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2 text-right">
              Showing {filteredUsers.length} of {appUsers.length} users
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
