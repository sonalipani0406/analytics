

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: {
      date: string;
      count: number;
      uniqueVisitors: number;
      returningVisitors: number;
    };
  }[];
}

export interface TrafficTimelineData {
  date: string;
  count: number;
  unique_visitors: number;
  returning_visitors: number;
}

export function TrafficTimelineChart({
  data,
  granularity = 'day'
}: {
  data: TrafficTimelineData[]
  granularity?: 'day' | 'week' | 'month' | 'hour'
}) {

  const chartData = data?.map(item => ({
    date: new Date(item.date),
    count: item.count,
    uniqueVisitors: item.unique_visitors || 0,
    returningVisitors: item.returning_visitors || 0,
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatDate = (date: Date) => {
    if (granularity === 'month') {
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } else if (granularity === 'week') {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (granularity === 'hour') {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const dateObj = new Date(data.date);
      let dateLabel = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

      if (granularity === 'month') {
        dateLabel = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      } else if (granularity === 'week') {
        dateLabel = 'Week of ' + dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } else if (granularity === 'hour') {
        dateLabel = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } else {
        dateLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }

      return (
        <div className="bg-gray-800 text-white p-4 rounded-md border border-gray-700 shadow-xl">
          <p className="font-semibold mb-2 border-b border-gray-600 pb-1">{dateLabel}</p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between gap-4"><span className="text-emerald-400">Total Visitors:</span> <span>{data.count}</span></p>
            <p className="flex justify-between gap-4"><span className="text-blue-400">Unique Visitors:</span> <span>{data.uniqueVisitors}</span></p>
            <p className="flex justify-between gap-4"><span className="text-purple-400">Returning:</span> <span>{data.returningVisitors}</span></p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> Traffic Timeline ({granularity})</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300} className="md:h-[400px]">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tickFormatter={(tick) => formatDate(new Date(tick))}
              minTickGap={30}
            />
            <YAxis stroke="#9ca3af" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
