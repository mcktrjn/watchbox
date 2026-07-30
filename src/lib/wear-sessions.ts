import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesUpdate } from "@/lib/database.types";

export type WearSession = Tables<"wear_sessions">;

export async function listSessions(
  supabase: SupabaseClient<Database>,
  userId: string,
  watchId: string,
): Promise<WearSession[]> {
  const { data, error } = await supabase
    .from("wear_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("watch_id", watchId)
    .order("started_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getSessionById(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
): Promise<WearSession | null> {
  const { data, error } = await supabase
    .from("wear_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  watchId: string,
  input: { startedAt: string; endedAt: string },
): Promise<WearSession> {
  const { data, error } = await supabase
    .from("wear_sessions")
    .insert({
      user_id: userId,
      watch_id: watchId,
      started_at: input.startedAt,
      ended_at: input.endedAt,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
  input: { startedAt?: string; endedAt?: string },
): Promise<WearSession> {
  const updateData: TablesUpdate<"wear_sessions"> = {};
  if (input.startedAt !== undefined) updateData.started_at = input.startedAt;
  if (input.endedAt !== undefined) updateData.ended_at = input.endedAt;

  const { data, error } = await supabase
    .from("wear_sessions")
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("wear_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("id", sessionId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
