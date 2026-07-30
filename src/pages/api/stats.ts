import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getStats, type Period } from "@/lib/statistics";

const VALID_PERIODS: Period[] = ["week", "month", "year"];

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const rawPeriod = context.url.searchParams.get("period");
  if (!rawPeriod || !VALID_PERIODS.includes(rawPeriod as Period)) {
    return Response.json({ error: "period must be week, month, or year" }, { status: 400 });
  }

  try {
    const stats = await getStats(supabase, user.id, rawPeriod as Period);
    return Response.json(stats, { status: 200 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};
