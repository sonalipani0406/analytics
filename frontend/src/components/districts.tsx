"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map } from "@/components/ui/map";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card as UiCard } from "@/components/ui/card";
import React from "react";

type District = {
  name: string;
  count?: number;
  latitude?: number;
  longitude?: number;
  geometry?: any;
  [k: string]: any;
};

export default function Districts({ selectedSite }: { selectedSite?: string }) {
  const [states, setStates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [districtsByState, setDistrictsByState] = useState<Record<string, District[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedSite) params.set('site_filter', selectedSite);
        const res = await fetch(`/api/districts?${params.toString()}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();

        if (json.by_state) {
          setDistrictsByState(json.by_state);
          setStates(Object.keys(json.by_state));
          setSelectedState(prev => prev || Object.keys(json.by_state)[0] || null);
        } else if (json.states && json.districts) {
          const map: Record<string, District[]> = {};
          json.states.forEach((s: string) => map[s] = []);
          for (const d of json.districts) {
            const s = d.state || d.region || 'Unknown';
            map[s] = map[s] || [];
            map[s].push(d);
          }
          setDistrictsByState(map);
          setStates(Object.keys(map));
          setSelectedState(prev => prev || Object.keys(map)[0] || null);
        } else if (Array.isArray(json)) {
          const map: Record<string, District[]> = {};
          for (const d of json) {
            const s = d.state || d.region || 'Unknown';
            map[s] = map[s] || [];
            map[s].push(d);
          }
          setDistrictsByState(map);
          setStates(Object.keys(map));
          setSelectedState(prev => prev || Object.keys(map)[0] || null);
        } else {
          setDistrictsByState({});
          setStates([]);
          setSelectedState(null);
        }
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

  const list = useMemo(() => {
    if (!selectedState) return [] as District[];
    return districtsByState[selectedState] || [];
  }, [selectedState, districtsByState]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div className="mb-4 flex items-center gap-4">
          <div className="w-56">
            <label className="text-xs font-bold uppercase tracking-wide text-primary mb-2 block">State</label>
            <Select value={selectedState || ''} onValueChange={(v) => setSelectedState(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <UiCard>
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-2">Districts</h3>
            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loading && list.length === 0 && <div className="text-sm text-muted-foreground">No district data available for selected state.</div>}
            {!loading && list.length > 0 && (
              <div className="space-y-2">
                {list.map((d, i) => (
                  <div key={d.name + i} className="flex justify-between items-center p-2 border rounded">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-sm text-muted-foreground">{d.count ?? 0}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </UiCard>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>District Map</CardTitle>
          </CardHeader>
          <CardContent className="h-[600px] w-full rounded-lg overflow-hidden border border-border">
            <Map>
            </Map>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
