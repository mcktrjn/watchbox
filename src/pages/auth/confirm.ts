import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const GET: APIRoute = async (context) => {
  const { searchParams } = new URL(context.request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  // Prevent open-redirect: only allow relative paths
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (token_hash && type) {
    const supabase = createClient(context.request.headers, context.cookies);
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (!error) {
        return context.redirect(safeNext);
      }
      return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
    }
  }

  return context.redirect(`/auth/signin?error=${encodeURIComponent("Invalid confirmation link")}`);
};
