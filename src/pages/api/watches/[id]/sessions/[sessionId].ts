import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateSession, deleteSession } from "@/lib/wear-sessions";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.code === "string") {
      const details = typeof obj.details === "string" ? obj.details : "";
      return `${obj.code}: ${details}`;
    }
  }
  return "Unexpected error";
}

function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (obj.code === "PGRST116") return true;
    if (typeof obj.message === "string" && (obj.message.includes("0 rows") || obj.message.includes("PGRST116")))
      return true;
  }
  return false;
}

export const PUT: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const sessionId = context.params.sessionId;
  if (!sessionId) {
    return Response.json({ error: "Missing session id" }, { status: 400 });
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

  const input: { startedAt?: string; endedAt?: string } = {};

  if (rawDate !== undefined || rawStartTime !== undefined || rawEndTime !== undefined) {
    // If any time field is provided, date must also be provided
    if (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return Response.json(
        { error: "date must be a valid ISO date string (YYYY-MM-DD) when updating times" },
        { status: 400 },
      );
    }

    // Reject future dates
    const dateObj = new Date(rawDate + "T00:00:00");
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dateObj > today) {
      return Response.json({ error: "Date cannot be in the future" }, { status: 400 });
    }

    if (rawStartTime !== undefined) {
      if (typeof rawStartTime !== "string" || !/^\d{2}:\d{2}$/.test(rawStartTime)) {
        return Response.json({ error: "startTime must be in HH:MM format" }, { status: 400 });
      }
      input.startedAt = new Date(`${rawDate}T${rawStartTime}:00`).toISOString();
    }

    if (rawEndTime !== undefined) {
      if (typeof rawEndTime !== "string" || !/^\d{2}:\d{2}$/.test(rawEndTime)) {
        return Response.json({ error: "endTime must be in HH:MM format" }, { status: 400 });
      }
      input.endedAt = new Date(`${rawDate}T${rawEndTime}:00`).toISOString();
    }

    // If both timestamps are set, validate endedAt > startedAt
    if (input.startedAt && input.endedAt) {
      if (new Date(input.endedAt) <= new Date(input.startedAt)) {
        return Response.json({ error: "End time must be after start time" }, { status: 400 });
      }
    }
  }

  try {
    const session = await updateSession(supabase, user.id, sessionId, input);
    return Response.json(session, { status: 200 });
  } catch (error) {
    if (isNotFoundError(error)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const sessionId = context.params.sessionId;
  if (!sessionId) {
    return Response.json({ error: "Missing session id" }, { status: 400 });
  }

  try {
    await deleteSession(supabase, user.id, sessionId);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (isNotFoundError(error)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};
