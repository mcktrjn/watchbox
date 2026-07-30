import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStatsState } from "@/components/statistics/EmptyStatsState";

type Period = "week" | "month" | "year";
type Metric = "hours" | "sessions";

interface StatRow {
  watchId: string;
  watchName: string;
  totalHours: number;
  sessionCount: number;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function formatHours(hours: number): string {
  return String(Math.round(hours * 10) / 10) + "h";
}

function CustomTooltip({
  active,
  payload: payloadData,
}: {
  active?: boolean;
  payload?: { payload: StatRow; name: string }[];
}) {
  if (!active || payloadData.length === 0) return null;
  const row = payloadData[0].payload;
  const name = payloadData[0].name;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900 px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-white">{row.watchName}</p>
      <p className="text-xs text-blue-300">
        {name === "totalHours"
          ? `${formatHours(row.totalHours)} worn`
          : `${row.sessionCount} session${row.sessionCount !== 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

export function StatsView() {
  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<Metric>("hours");
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/stats?period=${period}`);
        if (!response.ok) {
          throw new Error("Failed to load statistics");
        }
        const data = (await response.json()) as StatRow[];
        if (!cancelled) {
          setStats(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unexpected error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [period, retryCounter]);

  const handleRetry = () => {
    setRetryCounter((c) => c + 1);
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  const sortedStats = metric === "hours" ? stats : [...stats].sort((a, b) => b.sessionCount - a.sessionCount);

  const totalHours = stats.reduce((sum, s) => sum + s.totalHours, 0);
  const mostWorn = stats.length > 0 ? stats[0] : null;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.key}
            variant={p.key === period ? "default" : "outline"}
            size="sm"
            onClick={() => {
              handlePeriodChange(p.key);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-blue-100/60">No data for this period.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-blue-100/60">Most Worn</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {mostWorn ? `${mostWorn.watchName} — ${formatHours(mostWorn.totalHours)}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-100/60">Total Hours</p>
                <p className="mt-1 text-sm font-medium text-white">{formatHours(totalHours)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-100/60">Watches Worn</p>
                <p className="mt-1 text-sm font-medium text-white">{stats.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metric Toggle & Chart */}
      {stats.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant={metric === "hours" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMetric("hours");
              }}
            >
              Hours
            </Button>
            <Button
              variant={metric === "sessions" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMetric("sessions");
              }}
            >
              Sessions
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <ResponsiveContainer width="100%" height={Math.max(200, sortedStats.length * 50)}>
              <BarChart data={sortedStats} layout="vertical" margin={{ left: 20, right: 20, top: 8, bottom: 8 }}>
                <XAxis
                  type="number"
                  tick={{ fill: "#93c5fd", fontSize: 12 }}
                  tickLine={{ stroke: "#93c5fd" }}
                  axisLine={{ stroke: "#334155" }}
                  label={{
                    value: metric === "hours" ? "hours" : "sessions",
                    position: "insideBottomRight",
                    offset: -4,
                    fill: "#93c5fd",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  dataKey="watchName"
                  type="category"
                  width={160}
                  tick={{ fill: "#93c5fd", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={metric === "hours" ? "totalHours" : "sessionCount"}
                  fill="url(#statsGradient)"
                  radius={[0, 4, 4, 0]}
                />
                <defs>
                  <linearGradient id="statsGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyStatsState />
      )}
    </div>
  );
}
