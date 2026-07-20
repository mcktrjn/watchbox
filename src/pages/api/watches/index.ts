import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createWatch, listWatches } from "@/lib/watches";

const MAX_NAME_LENGTH = 100;

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

  try {
    const watches = await listWatches(supabase, user.id);
    return Response.json(watches, { status: 200 });
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

  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return Response.json(
      { error: `Name is required and must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const photoUrl = typeof rawPhotoUrl === "string" ? rawPhotoUrl : null;

  try {
    const watch = await createWatch(supabase, user.id, { name, photoUrl });
    return Response.json(watch, { status: 201 });
  } catch (error) {
    return Response.json({ error: toErrorMessage(error) }, { status: 500 });
  }
};
