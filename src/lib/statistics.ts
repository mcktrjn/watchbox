import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Period = "week" | "month" | "year";

export interface StatRow {
  watchId: string;
  watchName: string;
  totalHours: number;
  sessionCount: number;
}

function getPeriodStart(period: Period): Date {
  const now = new Date();
  const days = period === "week" ? 7 : period === "month" ? 30 : 365;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getStats(supabase: SupabaseClient<Database>, userId: string, period: Period): Promise<StatRow[]> {
  const periodStart = getPeriodStart(period);

  const { data, error } = await supabase
    .from("wear_sessions")
    .select(
      `
      watch_id,
      started_at,
      ended_at,
      watches!inner(name, deleted_at)
    `,
    )
    .eq("user_id", userId)
    .gte("started_at", periodStart.toISOString());

  if (error) {
    throw error;
  }

  // Aggregate in JS: group by watch, sum hours, count sessions
  const grouped = new Map<string, { watchName: string; totalHours: number; sessionCount: number }>();

  for (const row of data) {
    const watch = row.watches;

    // Skip soft-deleted watches
    if (watch.deleted_at !== null) continue;

    const key = row.watch_id;

    let entry = grouped.get(key);
    if (!entry) {
      entry = { watchName: watch.name, totalHours: 0, sessionCount: 0 };
      grouped.set(key, entry);
    }
    const hours = (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / (1000 * 60 * 60);
    entry.totalHours += hours;
    entry.sessionCount += 1;
  }

  return Array.from(grouped.entries())
    .map(([watchId, stats]) => ({
      watchId,
      watchName: stats.watchName,
      totalHours: Math.round(stats.totalHours * 100) / 100,
      sessionCount: stats.sessionCount,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}
