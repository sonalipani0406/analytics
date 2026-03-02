"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type AppUser   = { [k: string]: any };
type SortDir   = "asc" | "desc";
type LocalPeriod = "24h" | "7d" | "30d" | "all" | "custom";



// ── App registry — add one line per new app ────────────────────────────────
const APP_OPTIONS = [
  { value: "fps",     label: "FPS App",     url: "https://coers.iitm.ac.in/fsa/user_det"     },
  { value: "sanjaya", label: "Sanjaya App", url: "https://coers.iitm.ac.in/fsa/dss_user_det" },
];

// ── Period tab definitions ─────────────────────────────────────────────────
const PERIOD_TABS: { value: LocalPeriod; label: string }[] = [
  { value: "24h",    label: "24H"    },
  { value: "7d",     label: "7D"     },
  { value: "30d",    label: "30D"    },
  { value: "all",    label: "All"    },
  { value: "custom", label: "Custom" },
];

// ── Column definitions ─────────────────────────────────────────────────────
const COLUMNS = [
  { key: "user_name",      label: "User Name"       },
  { key: "user_role",      label: "User Role"       },
  { key: "district",       label: "District"        },
  { key: "police_station", label: "Police Station"  },
  { key: "last_login",     label: "Last Login"      },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getField(user: AppUser, ...keys: string[]): string {
  for (const k of keys) {
    if (user[k] !== undefined && user[k] !== null && user[k] !== "") return String(user[k]);
  }
  return "—";
}

/** Convert a local period value into explicit start/end date strings (YYYY-MM-DD). */
function periodToDates(period: LocalPeriod): { start: string; end: string } {
  if (period === "all" || period === "custom") return { start: "", end: "" };
  const now  = new Date();
  const end  = now.toISOString().split("T")[0];
  const days = period === "24h" ? 1 : period === "7d" ? 7 : 30;
  const start = new Date(now.getTime() - days * 86_400_000).toISOString().split("T")[0];
  return { start, end };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Districts() {
  // ── State ─────────────────────────────────────────────────────────────
  const [selectedApp,    setSelectedApp]    = useState("fps");
  const [allUsers,       setAllUsers]       = useState<AppUser[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // Local period tabs (self-contained, independent of global period buttons)
  const [localPeriod,  setLocalPeriod]  = useState<LocalPeriod>("all");
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");

  // Search filters
  const [nameSearch,     setNameSearch]     = useState("");
  const [districtSearch, setDistrictSearch] = useState("");

  // Sorting
  const [sortCol, setSortCol] = useState<string>("user_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination  (0 = show all)
  const [perPage, setPerPage] = useState<number>(10);

  // ── Derived date range ────────────────────────────────────────────────
  const { start: derivedStart, end: derivedEnd } = useMemo(() => {
    if (localPeriod === "custom") return { start: customStart, end: customEnd };
    return periodToDates(localPeriod);
  }, [localPeriod, customStart, customEnd]);

  // ── Fetch directly from external API ─────────────────────────────────
  useEffect(() => {
    const appConfig = APP_OPTIONS.find(a => a.value === selectedApp);
    if (!appConfig) return;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(appConfig.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_date: derivedStart, end_date: derivedEnd }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Normalise: handle {details:[...]}, {users:[...]}, or a bare array
        let list: AppUser[] = [];
        if (Array.isArray(json)) {
          list = json;
        } else if (Array.isArray(json.details)) {
          list = json.details.map((d: AppUser) => ({
            user_name:      d.rep_name || d.name || d.username || "",
            user_role:      d.user_role || d.role || "",
            district:       d.district_name || d.district || "",
            police_station: d.police_station || d.ps || "",
            last_login:     d.last_login || "",
          }));
        } else {
          for (const key of ["users", "data", "results"]) {
            if (Array.isArray(json[key])) { list = json[key]; break; }
          }
        }
        setAllUsers(list);
      } catch (e: any) {
        setError(e.message);
        setAllUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [selectedApp, derivedStart, derivedEnd]);

  // ── Sort helper ───────────────────────────────────────────────────────
  const handleSort = (col: string) => {
    if (col === sortCol) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  // ── Filter → sort → paginate ──────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    let rows = allUsers.filter(u => {
      const name = getField(u, "user_name", "name", "username").toLowerCase();
      const dist = getField(u, "district").toLowerCase();
      if (nameSearch     && !name.includes(nameSearch.toLowerCase()))     return false;
      if (districtSearch && !dist.includes(districtSearch.toLowerCase())) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const av = getField(a, sortCol).toLowerCase();
      const bv = getField(b, sortCol).toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [allUsers, nameSearch, districtSearch, sortCol, sortDir]);

  const displayedUsers = useMemo(
    () => (perPage === 0 ? filteredSorted : filteredSorted.slice(0, perPage)),
    [filteredSorted, perPage]
  );

  // ── Sort icon helper ──────────────────────────────────────────────────
  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-xs opacity-40 select-none">
      {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            App Users
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredSorted.length} user{filteredSorted.length !== 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>

          {/* App selector */}
          <div className="w-44">
            <Select value={selectedApp} onValueChange={v => { setSelectedApp(v); }}>
              <SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger>
              <SelectContent>
                {APP_OPTIONS.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex flex-wrap gap-1 mt-3">
          {PERIOD_TABS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setLocalPeriod(t.value)}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                localPeriod === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {localPeriod === "custom" && (
          <div className="flex flex-wrap gap-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block">From</Label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-sm border rounded px-2 py-1 bg-background"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">To</Label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-sm border rounded px-2 py-1 bg-background"
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Search filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs mb-1 block">Search by Name</Label>
            <Input
              placeholder="User name…"
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Filter by District</Label>
            <Input
              placeholder="District…"
              value={districtSearch}
              onChange={e => setDistrictSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Per-page selector + count */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-xs text-muted-foreground mr-1">Show:</span>
          {[10, 50, 100, 0].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setPerPage(n)}
              className={`px-2.5 py-0.5 text-xs border rounded transition-colors ${
                perPage === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {n === 0 ? "All" : n}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : `Showing ${displayedUsers.length} of ${filteredSorted.length}`}
          </span>
        </div>

        {/* Status */}
        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading users…</div>
        )}
        {!loading && error && (
          <div className="text-sm text-destructive py-2">Error: {error}</div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-2 font-semibold">#</th>
                  {COLUMNS.map(c => (
                    <th
                      key={c.key}
                      className="px-4 py-2 font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort(c.key)}
                    >
                      {c.label}
                      <SortIcon col={c.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                      {allUsers.length === 0
                        ? "No user data available for the selected period."
                        : "No users match the current filters."}
                    </td>
                  </tr>
                ) : (
                  displayedUsers.map((u, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">
                        {getField(u, "user_name", "name", "username")}
                      </td>
                      <td className="px-4 py-2">{getField(u, "user_role", "role")}</td>
                      <td className="px-4 py-2">{getField(u, "district")}</td>
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
      </CardContent>
    </Card>
  );
}
