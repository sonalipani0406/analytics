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
  selectedPeriod?: "day" | "week" | "month" | "all" | "custom";
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
  const [allUsers, setAllUsers]       = useState<AppUser[]>([]);
  const [appUsers, setAppUsers]        = useState<AppUser[]>([]); // visible on current page
  const [loading, setLoading]          = useState(false);
  const [error, setError]              = useState<string | null>(null);
  const [perPage, setPerPage]          = useState(10);
  const [page, setPage]                = useState(1);

  // ── Local search/filter inputs ─────────────────────────────────────────
  const [nameSearch,     setNameSearch]     = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [psSearch,       setPsSearch]       = useState("");

  // ── Fetch directly from external FSA API ──────────────────────────
  // re-run whenever the app, period, or custom dates change.
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      try {
        const body: any = { app: selectedApp, period: selectedPeriod };
        if (filters.start_date_filter) body.start_date = filters.start_date_filter;
        if (filters.end_date_filter)   body.end_date   = filters.end_date_filter;

        const res = await fetch('https://coers.iitm.ac.in/fsa/user_det', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json.error) {
          throw new Error(json.error || json.status || 'Unknown error');
        }
        // upstream returns a status string; only treat it as an error
        if (json.status && typeof json.status === 'string') {
          const code = json.statusCode || '';
          if (/^(5|4)/.test(code) || json.status.toLowerCase().startsWith('failed')) {
            throw new Error(json.status);
          }
        }

        let list: AppUser[] = [];
        if (Array.isArray(json.details)) {
          list = json.details.map((d: any) => ({
            userid: d.userid,
            user_name: d.rep_name || d.name || '',
            user_role: d.user_role,
            district: d.district_name,
            police_station: d.police_station,
            last_login: d.last_login,
            phone: d.phone_no,
            raw: d,
          }));
        } else if (Array.isArray(json)) {
          list = json;
        }

        setAllUsers(list);
        setAppUsers(list.slice(0, perPage));
      } catch (e: any) {
        setError(e.message);
        setAllUsers([]);
        setAppUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [selectedApp, selectedPeriod, filters.start_date_filter, filters.end_date_filter, perPage]);

  // keep visible portion in sync with paging
  useEffect(() => {
    setAppUsers(allUsers.slice(0, page * perPage));
  }, [allUsers, page, perPage]);

  // ── Client-side filtering on the visible rows ──────────────────────────
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
        {/* pagination controls */}
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs">Per page:</label>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="text-sm"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={() => {
              const next = page + 1;
              const slice = allUsers.slice(0, next * perPage);
              setAppUsers(slice);
              setPage(next);
            }}
            disabled={page * perPage >= allUsers.length}
            className="ml-auto px-2 py-1 text-xs border rounded"
          >
            Load more
          </button>
        </div>

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
