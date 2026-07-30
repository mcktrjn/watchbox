import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { listSessions, createSession } from "@/lib/wear-sessions";

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

  const watchId = context.params.id;
  if (!watchId) {
    return Response.json({ error: "Missing watch id" }, { status: 400 });
  }

  try {
    const sessions = await listSessions(supabase, user.id, watchId);
    return Response.json(sessions, { status: 200 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const watchId = context.params.id;
  if (!watchId) {
    return Response.json({ error: "Missing watch id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    date: rawDate,
    startTime: rawStartTime,
    endTime: rawEndTime,
  } = body as {
    date?: unknown;
    startTime?: unknown;
    endTime?: unknown;
  };

  if (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return Response.json({ error: "date must be a valid ISO date string (YYYY-MM-DD)" }, { status: 400 });
  }

  if (typeof rawStartTime !== "string" || !/^\d{2}:\d{2}$/.test(rawStartTime)) {
    return Response.json({ error: "startTime must be in HH:MM format" }, { status: 400 });
  }

  if (typeof rawEndTime !== "string" || !/^\d{2}:\d{2}$/.test(rawEndTime)) {
    return Response.json({ error: "endTime must be in HH:MM format" }, { status: 400 });
  }

  // Reject future dates
  const dateObj = new Date(rawDate + "T00:00:00");
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (dateObj > today) {
    return Response.json({ error: "Date cannot be in the future" }, { status: 400 });
  }

  // Assemble ISO timestamps
  const startedAt = new Date(`${rawDate}T${rawStartTime}:00`).toISOString();
  const endedAt = new Date(`${rawDate}T${rawEndTime}:00`).toISOString();

  // Validate endedAt > startedAt
  if (new Date(endedAt) <= new Date(startedAt)) {
    return Response.json({ error: "End time must be after start time" }, { status: 400 });
  }

  try {
    const session = await createSession(supabase, user.id, watchId, { startedAt, endedAt });
    return Response.json(session, { status: 201 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};
