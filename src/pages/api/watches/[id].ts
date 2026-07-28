import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getWatchById, updateWatch, deleteWatch } from "@/lib/watches";

const MAX_NAME_LENGTH = 100;

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

export const GET: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const id = context.params.id;
  if (!id) {
    return Response.json({ error: "Missing watch id" }, { status: 400 });
  }

  try {
    const watch = await getWatchById(supabase, user.id, id);
    if (!watch) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(watch, { status: 200 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const id = context.params.id;
  if (!id) {
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

  const { name: rawName, photoUrl: rawPhotoUrl } = body as { name?: unknown; photoUrl?: unknown };

  if (rawName !== undefined) {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      return Response.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` }, { status: 400 });
    }
  }

  const photoUrl = rawPhotoUrl === undefined ? undefined : typeof rawPhotoUrl === "string" ? rawPhotoUrl : null;

  const name = typeof rawName === "string" ? rawName.trim() : undefined;

  try {
    const watch = await updateWatch(supabase, user.id, id, { name, photoUrl });
    return Response.json(watch, { status: 200 });
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

  const id = context.params.id;
  if (!id) {
    return Response.json({ error: "Missing watch id" }, { status: 400 });
  }

  try {
    await deleteWatch(supabase, user.id, id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (isNotFoundError(error)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};
