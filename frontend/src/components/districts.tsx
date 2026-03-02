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



// ── Column type ────────────────────────────────────────────────────────────
type ColDef = { key: string; label: string };

// =============================================================================
// ✏️  APP CONFIG — THE ONLY PLACE YOU NEED TO EDIT TO ADD A NEW APP
//
//   value    : unique slug (used internally)
//   label    : name shown in the dropdown
//   url      : POST endpoint that returns user data
//   payload  : function → JSON body sent to the API (adjust keys per app)
//   loginKey : field name(s) that hold the last-login timestamp (for period filter)
//   columns  : ordered list of columns to show in the table
//   normalise: function that maps a raw API row → a flat AppUser object
//              (keys must match the `key` values in `columns`)
//
// To add a new app, just add one more object below.
// =============================================================================
const APP_OPTIONS: {
  value: string;
  label: string;
  url: string;
  payload: (start: string, end: string) => Record<string, string>;
  loginKey: string[];
  columns: ColDef[];
  normalise: (raw: AppUser) => AppUser;
}[] = [
  // ── FPS App ────────────────────────────────────────────────────────────────
  {
    value:    "fps",
    label:    "FPS App",
    url:      "https://coers.iitm.ac.in/fsa/user_det",
    payload:  (start, end) => ({ start_date: start, end_date: end }),
    loginKey: ["last_login", "last_seen", "lastLogin", "last_active"],
    columns: [
      { key: "user_name",      label: "User Name"      },
      { key: "user_role",      label: "User Role"      },
      { key: "district",       label: "District"       },
      { key: "police_station", label: "Police Station" },
      { key: "last_login",     label: "Last Login"     },
    ],
    normalise: (d) => ({
      user_name:      d.rep_name      || d.user_name   || d.name     || d.username || "",
      user_role:      d.user_role     || d.role        || "",
      district:       d.district_name || d.district    || "",
      police_station: d.police_station|| d.ps          || d.policeStation || "",
      last_login:     d.last_login    || d.last_seen   || d.lastLogin || "",
    }),
  },

  // ── Sanjaya App ────────────────────────────────────────────────────────────
  {
    value:    "sanjaya",
    label:    "Sanjaya App",
    url:      "https://coers.iitm.ac.in/fsa/dss_user_det",
    payload:  (start, end) => ({ start_date: start, end_date: end }),
    loginKey: ["last_login", "last_seen", "lastLogin", "last_active"],
    columns: [
      { key: "user_name",  label: "User Name"  },
      { key: "user_role",  label: "User Role"  },
      { key: "district",   label: "District"   },
      { key: "last_login", label: "Last Login" },
    ],
    normalise: (d) => ({
      user_name:  d.rep_name      || d.user_name || d.name     || d.username || "",
      user_role:  d.user_role     || d.role      || "",
      district:   d.district_name || d.district  || "",
      last_login: d.last_login    || d.last_seen || d.lastLogin || "",
    }),
  },

  // ── TPL App ────────────────────────────────────────────────────────────────
  {
    value:    "tpl",
    label:    "TPL App",
    url:      "https://coers.iitm.ac.in/baseline/export_all_data",
    payload:  (start, end) => ({ start_date: start, end_date: end }),
    loginKey: [], // TPL has no last_login field — period filter is skipped
    columns: [
      { key: "user_id",       label: "User ID"       },
      { key: "state",         label: "State"         },
      { key: "district",      label: "District"      },
      { key: "hospital_name", label: "Hospital Name" },
    ],
    normalise: (d) => ({
      user_id:       d.user_id       || String(d.userid ?? "") || "",
      state:         d.state_name    || d.state               || "",
      district:      d.district_name || d.district            || "",
      hospital_name: d.hospname      || d.hospital_name       || d.hospital || "",
    }),
  },

  // ── Add more apps here ─────────────────────────────────────────────────────
];

// ── Period tab definitions ─────────────────────────────────────────────────
const PERIOD_TABS: { value: LocalPeriod; label: string }[] = [
  { value: "24h",    label: "24H"    },
  { value: "7d",     label: "7D"     },
  { value: "30d",    label: "30D"    },
  { value: "all",    label: "All"    },
  { value: "custom", label: "Custom" },
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

  // ── Active app config ─────────────────────────────────────────────────
  const appConfig = APP_OPTIONS.find(a => a.value === selectedApp) ?? APP_OPTIONS[0];

  // ── Derived date range ────────────────────────────────────────────────
  const { start: derivedStart, end: derivedEnd } = useMemo(() => {
    if (localPeriod === "custom") return { start: customStart, end: customEnd };
    return periodToDates(localPeriod);
  }, [localPeriod, customStart, customEnd]);

  // ── Fetch directly from external API ─────────────────────────────────
  useEffect(() => {

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(appConfig.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // uses the per-app payload fn — different apps can have different body keys
          body: JSON.stringify(appConfig.payload(derivedStart, derivedEnd)),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Extract the raw array from whatever shape the API returns
        let raw: AppUser[] = [];
        if (Array.isArray(json)) {
          raw = json;
        } else {
          for (const key of ["details", "users", "data", "results"]) {
            if (Array.isArray(json[key])) { raw = json[key]; break; }
          }
        }
        // Apply per-app normalise function so columns always match the config
        setAllUsers(raw.map(appConfig.normalise));
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
    // Build cutoff boundaries from the selected period.
    // The external API ignores date params, so we filter client-side on last_login.
    const cutoffStart = derivedStart ? new Date(derivedStart) : null;
    // end-of-day so today's logins are included
    const cutoffEnd   = derivedEnd   ? new Date(derivedEnd + "T23:59:59") : null;

    let rows = allUsers.filter((u: AppUser) => {
      // ── name filter ──
      const name = getField(u, "user_name", "name", "username").toLowerCase();
      if (nameSearch && !name.includes(nameSearch.toLowerCase())) return false;

      // ── district filter ──
      const dist = getField(u, "district").toLowerCase();
      if (districtSearch && !dist.includes(districtSearch.toLowerCase())) return false;

      // ── period filter (client-side, using per-app loginKey list) ──
      // Skip entirely if this app has no login date field (loginKey is empty)
      if (appConfig.loginKey.length > 0 && (cutoffStart || cutoffEnd)) {
        const loginStr = getField(u, ...appConfig.loginKey);
        if (loginStr === "—") return false; // no login date → exclude from period view
        const loginDate = new Date(loginStr);
        if (isNaN(loginDate.getTime())) return true; // unparseable → keep the row
        if (cutoffStart && loginDate < cutoffStart) return false;
        if (cutoffEnd   && loginDate > cutoffEnd)   return false;
      }

      return true;
    });

    rows = [...rows].sort((a: AppUser, b: AppUser) => {
      const av = getField(a, sortCol).toLowerCase();
      const bv = getField(b, sortCol).toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [allUsers, nameSearch, districtSearch, sortCol, sortDir, derivedStart, derivedEnd]);

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

        {/* Table — columns come from appConfig.columns, fully dynamic */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-2 font-semibold">#</th>
                  {appConfig.columns.map(c => (
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
                    <td colSpan={appConfig.columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                      {allUsers.length === 0
                        ? "No user data available for the selected period."
                        : "No users match the current filters."}
                    </td>
                  </tr>
                ) : (
                  displayedUsers.map((u, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      {appConfig.columns.map((c, ci) => (
                        <td
                          key={c.key}
                          className={`px-4 py-2${ci === 0 ? " font-medium" : ""}`}
                        >
                          {getField(u, c.key)}
                        </td>
                      ))}
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
