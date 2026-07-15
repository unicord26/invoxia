// Thin fetch client for the Invoixe NestJS API. Attaches the Supabase access token.
import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (typeof window !== "undefined") {
    const biz = localStorage.getItem("leafx.businessId");
    if (biz) headers["x-business-id"] = biz;
  }
  return headers;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: async <T>(path: string) =>
    handle<T>(await fetch(`${BASE}${path}`, { headers: await authHeaders() })),
  post: async <T>(path: string, body: unknown) =>
    handle<T>(
      await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(body),
      })
    ),
  patch: async <T>(path: string, body: unknown) =>
    handle<T>(
      await fetch(`${BASE}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(body),
      })
    ),
  put: async <T>(path: string, body: unknown) =>
    handle<T>(
      await fetch(`${BASE}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(body),
      })
    ),
  del: async (path: string) =>
    handle<void>(await fetch(`${BASE}${path}`, { method: "DELETE", headers: await authHeaders() })),
};
