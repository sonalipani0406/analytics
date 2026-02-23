
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export interface StatsGridProps {
  stats: {
    total_visitors: number;
    unique_visitors: number;
    repeated_visitors: number;
    avg_time_on_page: number;
  };
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4 md:mb-12">
      <StatCard
        title="Total Visitors"
        value={stats?.total_visitors || "-"}
        icon={<Users className="h-6 w-6 text-muted-foreground" />}
      />
      <StatCard
        title="Unique Visitors"
        value={stats?.unique_visitors || "-"}
        icon={<UserCheck className="h-6 w-6 text-muted-foreground" />}
      />
      <StatCard
        title="Returning Visitors"
        value={stats?.repeated_visitors || "-"}
        icon={<UserX className="h-6 w-6 text-muted-foreground" />}
      />
      <StatCard
        title="Avg. Session (sec)"
        value={stats?.avg_time_on_page || "-"}
        icon={<Clock className="h-6 w-6 text-muted-foreground" />}
      />
    </div>
  );
}
