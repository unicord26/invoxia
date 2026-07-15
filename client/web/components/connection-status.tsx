"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/**
 * Startup handshake: on load, ping the API's /api/health (which itself pings
 * Supabase) and surface the result — a green console line when the full
 * client→server→Supabase chain is healthy, a toast when it isn't. Renders nothing.
 */
export function ConnectionStatus() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/health`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && body?.ok) {
          console.log(
            `%c✓ Connected to Invoixe API @ ${API} — Supabase ${body.supabase?.db} (${body.supabase?.latencyMs}ms)`,
            "color:#16a34a;font-weight:600"
          );
        } else {
          console.warn("⚠ Invoixe API reachable but Supabase is unhealthy:", body?.supabase);
          toast.warning("Backend database is unavailable — some features may not work.");
        }
      } catch (e) {
        if (cancelled) return;
        console.error(`✗ Cannot reach Invoixe API at ${API}. Is the server running?`, e);
        toast.error(`Cannot reach the server at ${API}. Is it running on port 5000?`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
