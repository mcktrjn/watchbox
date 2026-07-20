import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getWatchById } from "@/lib/watches";

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
