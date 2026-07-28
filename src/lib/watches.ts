import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";

export type Watch = Tables<"watches">;

export async function listWatches(supabase: SupabaseClient<Database>, userId: string): Promise<Watch[]> {
  const { data, error } = await supabase
    .from("watches")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getWatchById(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<Watch | null> {
  const { data, error } = await supabase
    .from("watches")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createWatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { name: string; photoUrl?: string | null },
): Promise<Watch> {
  const { data, error } = await supabase
    .from("watches")
    .insert({ user_id: userId, name: input.name, photo_url: input.photoUrl ?? null })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateWatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
  input: { name?: string; photoUrl?: string | null },
): Promise<Watch> {
  const updateData: Record<string, string | null> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.photoUrl !== undefined) updateData.photo_url = input.photoUrl;

  const { data, error } = await supabase
    .from("watches")
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("watches")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
