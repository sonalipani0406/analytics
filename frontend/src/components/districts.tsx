"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";
import { Download } from "lucide-react";

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
//   extract  : function → pulls the raw array out of the API response
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
  extract: (json: any) => AppUser[];
  loginKey: string[];
  columns: ColDef[];
  normalise: (raw: AppUser) => AppUser;
  extraFilters?: { key: string; label: string }[];
}[] = [
  // ── FPS App ────────────────────────────────────────────────────────────────
  // Fields: rep_name, user_role, type, state_name, district_name, police_station, last_login
  {
    value:    "fps",
    label:    "FPS App",
    url:      "https://coers.iitm.ac.in/fsa/user_det",
    payload:  (start, end) => ({ start_date: start, end_date: end }),
    extract:  (json: any): AppUser[] => {
      if (Array.isArray(json))              return json;
      if (Array.isArray(json?.details))     return json.details;
      if (Array.isArray(json?.data))        return json.data;
      if (Array.isArray(json?.users))       return json.users;
      if (Array.isArray(json?.results))     return json.results;
      return [];
    },
    loginKey: ["last_login", "last_seen", "lastLogin", "last_active"],
    columns: [
      { key: "user_name",      label: "User Name"      },
      { key: "user_role",      label: "User Role"      },
      { key: "designation",    label: "Designation"    },
      { key: "created_on",     label: "Created On"     },
      { key: "state",          label: "State"          },
      { key: "district",       label: "District"       },
      { key: "police_station", label: "Police Station" },
      { key: "last_login",     label: "Last Login"     },
    ],
    normalise: (d: AppUser): AppUser => ({
      user_name:      d.rep_name       || d.user_name    || d.name          || d.username || "",
      user_role:      d.user_role      || d.role         || "",
      designation:    d.type           || d.designation  || "",
      created_on:     toDateOnly(d.created_at || d.created_on),
      state:          d.state_name     || d.state        || "",
      district:       d.district_name  || d.district     || "",
      police_station: d.police_station || d.ps           || d.policeStation || "",
      last_login:     (d.last_login || d.last_seen || d.lastLogin || "").split(" ")[0],
    }),
    extraFilters: [
      { key: "designation", label: "Designation" },
      { key: "user_role",   label: "User Role"   },
    ],
  },

  // ── Sanjaya App ────────────────────────────────────────────────────────────
  // Fields: userid, name, account_status, designation, stakeholder, state_name, district_name, last_login
  {
    value:    "sanjaya",
    label:    "Sanjaya App",
    url:      "https://rbg.iitm.ac.in/get_details/export_all_data",
    payload:  (start, end) => ({ start_date: start, end_date: end }),
    extract:  (json: any): AppUser[] => {
      if (!json?.details) return [];
      const result: AppUser[] = [];
      if (Array.isArray(json.details.users))   result.push(...json.details.users.map((u: any)   => ({ ...u, _role: "User"   })));
      if (Array.isArray(json.details.admins))  result.push(...json.details.admins.map((u: any)  => ({ ...u, _role: "Admin"  })));
      if (Array.isArray(json.details.surveys)) result.push(...json.details.surveys.map((u: any) => ({ ...u, _role: "Survey" })));
      return result;
    },
    loginKey: ["last_login"],
    columns: [
      { key: "user_id",        label: "User ID"        },
      { key: "name",           label: "Name"           },
      { key: "state",          label: "State"          },
      { key: "district",       label: "District"       },
      { key: "designation",    label: "Designation"    },
      { key: "stakeholder",    label: "Stakeholder"    },
      { key: "account_status", label: "Account Status" },
      { key: "role",           label: "Role"           },
      { key: "last_login",     label: "Last Login"     },
    ],
    normalise: (d: AppUser): AppUser => ({
      user_id:        d.userid         || d.user_id      || "",
      name:           d.name           || "",
      state:          d.state_name     || d.state        || "",
      district:       d.district_name  || d.district     || "",
      designation:    d.designation    || "",
      stakeholder:    d.stakeholder    || "",
      account_status: d.account_status || "",
      role:           d._role          || d.role         || "",
      last_login:     (d.last_login    || d.last_seen    || "").split(" ")[0],
    }),
    extraFilters: [
      { key: "designation",    label: "Designation"    },
      { key: "account_status", label: "Account Status" },
    ],
  },

  // ── TPL App ────────────────────────────────────────────────────────────────
  // Fields: user_id, userid, hospname, category, state_name, district_name, last_login, user_status
  {
    value:    "tpl",
    label:    "TPL App",
    url:      "https://rbg.iitm.ac.in/bs_ddhi/export_all_data",
    payload:  (start, end) => ({ start_date: start, end_date: end }),
    extract:  (json: any): AppUser[] => {
      if (!json?.details) return [];
      const result: AppUser[] = [];
      if (Array.isArray(json.details.users)) {
        result.push(...json.details.users.map((u: any) => ({ ...u, _user_type: "User" })));
      }
      if (Array.isArray(json.details.admins)) {
        result.push(...json.details.admins.map((a: any) => ({ ...a, _user_type: "Admin" })));
      }
      return result;
    },
    loginKey: ["last_login"], // confirmed present in API response
    columns: [
      { key: "user_id",       label: "User ID"       },
      { key: "user_type",     label: "User Type"     },
      { key: "state",         label: "State"         },
      { key: "district",      label: "District"      },
      { key: "hospital_name", label: "Hospital Name" },
      { key: "category",      label: "Hospital Type" },
      { key: "last_login",    label: "Last Login"    },
    ],
    normalise: (d: AppUser): AppUser => ({
      user_id:       d.user_id       || d.admin_uid || String(d.userid ?? "") || String(d.admin_id ?? "") || "",
      user_type:     d._user_type    || d.admin_role || "User",
      state:         d.state_name    || d.state                || "",
      district:      d.district_name || d.district             || "",
      hospital_name: d.hospname      || d.hospital_name        || d.hospital || "",
      category:      (d.category     || "").trim().toUpperCase(),
      last_login:    (d.last_login   || "").split(" ")[0],
    }),
    extraFilters: [
      { key: "user_type", label: "User Type" },
      { key: "category", label: "Hospital Type" },
    ],
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toDateOnly(value: unknown): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return raw;
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
interface DistrictsProps {
  canExport?: boolean;
  allowedApps?: string[];
}

export default function Districts({ canExport = false, allowedApps = [] }: DistrictsProps) {
  const normalizedAllowedApps = useMemo(
    () => (allowedApps.length > 0 ? allowedApps : APP_OPTIONS.map((app) => app.value)),
    [allowedApps]
  );
  const availableApps = useMemo(
    () => APP_OPTIONS.filter((app) => normalizedAllowedApps.includes(app.value)),
    [normalizedAllowedApps]
  );

  // ── State ─────────────────────────────────────────────────────────────
  const [selectedApp,    setSelectedApp]    = useState(availableApps[0]?.value ?? "fps");
  const [allUsers,       setAllUsers]       = useState<AppUser[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // Local period tabs (self-contained, independent of global period buttons)
  const [localPeriod,  setLocalPeriod]  = useState<LocalPeriod>("30d");
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");

  // Dropdown filters
  const [selectedState,    setSelectedState]    = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [dropdownFilters,  setDropdownFilters]  = useState<Record<string, string>>({});

  // Sorting
  const [sortCol, setSortCol] = useState<string>("user_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination  (0 = show all)
  const [perPage, setPerPage] = useState<number>(0);

  // ── Active app config (memoised so filteredSorted dep array is stable) ──
  const appConfig = useMemo(
    () => availableApps.find((app) => app.value === selectedApp) ?? availableApps[0] ?? APP_OPTIONS[0],
    [selectedApp, availableApps]
  );

  useEffect(() => {
    if (!normalizedAllowedApps.includes(selectedApp)) {
      setSelectedApp(availableApps[0]?.value ?? "fps");
    }
  }, [selectedApp, normalizedAllowedApps, availableApps]);

  // ── Reset all dropdown filters when the app changes ──────────────────
  useEffect(() => {
    setSelectedState("all");
    setSelectedDistrict("all");
    setDropdownFilters({});
  }, [selectedApp]);

  // ── Unique state options derived from loaded data ─────────────────────
  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach(u => { const s = getField(u, "state"); if (s && s !== "—") set.add(s); });
    return Array.from(set).sort();
  }, [allUsers]);

  // ── District options filtered by selected state ───────────────────────
  const districtOptions = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach(u => {
      if (selectedState !== "all" && getField(u, "state") !== selectedState) return;
      const d = getField(u, "district");
      if (d && d !== "—") set.add(d);
    });
    return Array.from(set).sort();
  }, [allUsers, selectedState]);

  // ── Extra filter options per app config ───────────────────────────────
  const extraFilterOptions = useMemo(() => {
    const result: Record<string, string[]> = {};
    (appConfig.extraFilters ?? []).forEach(({ key }) => {
      const set = new Set<string>();
      allUsers.forEach(u => { const v = getField(u, key); if (v && v !== "—") set.add(v); });
      result[key] = Array.from(set).sort();
    });
    return result;
  }, [allUsers, appConfig]);

  // ── Derived date range ────────────────────────────────────────────────
  const { start: derivedStart, end: derivedEnd } = useMemo(() => {
    if (localPeriod === "custom") return { start: customStart, end: customEnd };
    return periodToDates(localPeriod);
  }, [localPeriod, customStart, customEnd]);

  // ── Fetch app users directly from app-specific external API ──────────
  useEffect(() => {
    // Capture the config for this specific app at the time the effect fires
    const cfg = APP_OPTIONS.find(a => a.value === selectedApp) ?? APP_OPTIONS[0];

    // Clear stale data immediately so we never show a previous app's rows
    setAllUsers([]);
    setError(null);

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(cfg.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg.payload(derivedStart, derivedEnd)),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Check if response indicates failure
        if (json.error) throw new Error(json.error);
        if (json.status && typeof json.status === 'string' && json.status.toLowerCase().includes('failed')) {
          throw new Error(json.status);
        }

        // Use the per-app extractor for direct upstream response shapes.
        const raw: AppUser[] = cfg.extract(json);
        if (!Array.isArray(raw)) {
          console.error(`[${cfg.label}] Extract returned non-array:`, raw);
          throw new Error(`Extract failed: returned ${typeof raw}`);
        }
        
        const normalized = raw.map((u) => {
          try {
            return cfg.normalise(u);
          } catch (err) {
            console.error(`[${cfg.label}] Normalise error on user:`, u, err);
            throw err;
          }
        });
        
        console.log(`[${cfg.label}] Loaded ${normalized.length} users`);
        setAllUsers(normalized);
      } catch (e: any) {
        console.error(`[${selectedApp}] Fetch failed:`, e);
        setError(e.message || String(e));
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
      // ── state dropdown filter ──
      if (selectedState !== "all" && getField(u, "state") !== selectedState) return false;

      // ── district dropdown filter ──
      if (selectedDistrict !== "all" && getField(u, "district") !== selectedDistrict) return false;

      // ── app-specific extra dropdown filters ──
      for (const [key, val] of Object.entries(dropdownFilters)) {
        if (val !== "all" && getField(u, key) !== val) return false;
      }

      // ── period filter (client-side, using per-app loginKey list) ──
      if (appConfig.loginKey.length > 0 && (cutoffStart || cutoffEnd)) {
        const loginStr = getField(u, ...appConfig.loginKey);
        if (loginStr === "—") return false;
        const loginDate = new Date(loginStr);
        if (isNaN(loginDate.getTime())) return true;
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
  }, [allUsers, appConfig, selectedState, selectedDistrict, dropdownFilters, sortCol, sortDir, derivedStart, derivedEnd]);

  const displayedUsers = useMemo(
    () => (perPage === 0 ? filteredSorted : filteredSorted.slice(0, perPage)),
    [filteredSorted, perPage]
  );

  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; value: string }> = [
      { label: "App", value: appConfig.label },
      { label: "Period", value: localPeriod === "custom" ? "Custom" : PERIOD_TABS.find(t => t.value === localPeriod)?.label ?? "All" },
    ];

    if (derivedStart) filters.push({ label: "From", value: derivedStart });
    if (derivedEnd) filters.push({ label: "To", value: derivedEnd });
    if (selectedState !== "all") filters.push({ label: "State", value: selectedState });
    if (selectedDistrict !== "all") filters.push({ label: "District", value: selectedDistrict });

    (appConfig.extraFilters ?? []).forEach(({ key, label }) => {
      const value = dropdownFilters[key];
      if (value && value !== "all") filters.push({ label, value });
    });

    filters.push({ label: "Sort", value: `${appConfig.columns.find(c => c.key === sortCol)?.label ?? sortCol} (${sortDir.toUpperCase()})` });
    filters.push({ label: "Rows", value: String(filteredSorted.length) });

    return filters;
  }, [appConfig, localPeriod, derivedStart, derivedEnd, selectedState, selectedDistrict, dropdownFilters, sortCol, sortDir, filteredSorted.length]);

  const exportFilename = useMemo(() => {
    const parts = [sanitizeFilePart(appConfig.label) || selectedApp];
    parts.push(`period-${sanitizeFilePart(localPeriod) || "all"}`);

    if (selectedState !== "all") parts.push(`state-${sanitizeFilePart(selectedState)}`);
    if (selectedDistrict !== "all") parts.push(`district-${sanitizeFilePart(selectedDistrict)}`);

    (appConfig.extraFilters ?? []).forEach(({ key, label }) => {
      const value = dropdownFilters[key];
      if (value && value !== "all") {
        parts.push(`${sanitizeFilePart(label)}-${sanitizeFilePart(value)}`);
      }
    });

    if (derivedStart) parts.push(`from-${derivedStart}`);
    if (derivedEnd) parts.push(`to-${derivedEnd}`);

    return `${parts.filter(Boolean).join("_") || "users"}.xls`;
  }, [appConfig, selectedApp, localPeriod, selectedState, selectedDistrict, dropdownFilters, derivedStart, derivedEnd]);

  const handleDownloadExcel = () => {
    const rows = filteredSorted.map((user, index) => [
      String(index + 1),
      ...appConfig.columns.map(c => getField(user, c.key)),
    ]);

    const worksheetRows = [
      ["Filtered User Export"],
      [],
      ...activeFilters.map(filter => [filter.label, filter.value]),
      [],
      ["#", ...appConfig.columns.map(c => c.label)],
      ...rows,
    ];

    const worksheetXml = worksheetRows
      .map(row => {
        const cells = row
          .map(cell => `<Cell><Data ss:Type="String">${escapeXml(String(cell ?? ""))}</Data></Cell>`)
          .join("");
        return `<Row>${cells}</Row>`;
      })
      .join("");

    const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(appConfig.label.slice(0, 31))}">
  <Table>${worksheetXml}</Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

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
            Total Users ({appConfig.label})
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
                {availableApps.map(a => (
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
        {/* Dropdown filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* State */}
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">State</Label>
            <Select value={selectedState} onValueChange={v => { setSelectedState(v); setSelectedDistrict("all"); }}>
              <SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {stateOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* District */}
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">District</Label>
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger><SelectValue placeholder="All Districts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {districtOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* App-specific extra filters */}
          {(appConfig.extraFilters ?? []).map(({ key, label }) => (
            <div key={key} className="min-w-[160px]">
              <Label className="text-xs mb-1 block">{label}</Label>
              <Select
                value={dropdownFilters[key] ?? "all"}
                onValueChange={v => setDropdownFilters(prev => ({ ...prev, [key]: v }))}
              >
                <SelectTrigger><SelectValue placeholder={`All ${label}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {label}</SelectItem>
                  {(extraFilterOptions[key] ?? []).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Per-page selector + count */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
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
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : `Showing ${displayedUsers.length} of ${filteredSorted.length}`}
            </span>
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                disabled={loading || !!error || filteredSorted.length === 0}
              >
                <Download className="size-4" />
                Export Excel
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">View-only access</span>
            )}
          </div>
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
          <div className="w-[93%] mx-auto overflow-x-auto rounded-md border">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2 font-semibold text-center">#</th>
                  {appConfig.columns.map(c => (
                    <th
                      key={c.key}
                      className="px-4 py-2 font-semibold text-center cursor-pointer select-none hover:bg-muted/80 transition-colors"
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
                      <td className="px-4 py-2 text-center text-muted-foreground">{i + 1}</td>
                      {appConfig.columns.map((c, ci) => (
                        <td
                          key={c.key}
                          className={`px-4 py-2 text-center${ci === 0 ? " font-medium" : ""}`}
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
