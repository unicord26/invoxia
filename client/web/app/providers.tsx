"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AppShell } from "../components/app-shell";
import { ConnectionStatus } from "../components/connection-status";
import { Toaster } from "@/components/ui/sonner";

type AuthState = { session: Session | null; signOut: () => Promise<void> };
const AuthCtx = createContext<AuthState>({ session: null, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let settled = false;
    const finish = (s: Session | null) => {
      settled = true;
      setSession(s);
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => finish(data.session))
      .catch((e) => {
        console.error("Supabase getSession() failed:", e);
        finish(null);
      });

    // onAuthStateChange fires an INITIAL_SESSION event almost immediately, so it
    // also clears loading — a backstop if getSession() is slow or hangs.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => finish(s));

    // Last-resort guard: never strand the user on the loading screen if the auth
    // handshake never settles (e.g. a hung getSession lock).
    const timeout = setTimeout(() => {
      if (!settled) {
        console.warn("Auth handshake did not settle within 8s; continuing without a session.");
        finish(null);
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const isPublic = pathname === "/login" || pathname.startsWith("/store");

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) router.replace("/login");
    if (session && pathname === "/login") router.replace("/");
  }, [session, loading, pathname, router, isPublic]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session && !isPublic) return null;

  // Public pages (login, storefront) render without the app shell.
  if (isPublic) {
    return <AuthCtx.Provider value={{ session, signOut }}>{children}</AuthCtx.Provider>;
  }

  // Authenticated area — wrap in the sidebar shell.
  return (
    <AuthCtx.Provider value={{ session, signOut }}>
      <AppShell email={session?.user?.email ?? undefined} onSignOut={signOut}>
        {children}
      </AppShell>
    </AuthCtx.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ConnectionStatus />
      <AuthGate>{children}</AuthGate>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
