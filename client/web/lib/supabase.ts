import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client. Persists the session in localStorage by default.
//
// The instance is cached on globalThis so Next.js dev HMR reuses ONE client
// across hot reloads. Without this, every reload runs createClient() again and
// spawns a fresh GoTrueClient; the instances share the same storage key and
// deadlock on the auth Web-Lock, which makes supabase.auth.getSession() hang
// forever — the app then gets stuck on the "Loading…" screen.
const globalForSupabase = globalThis as unknown as { __supabase?: SupabaseClient };

export const supabase =
  globalForSupabase.__supabase ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

if (process.env.NODE_ENV !== "production") globalForSupabase.__supabase = supabase;
