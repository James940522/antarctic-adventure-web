import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LeaderboardRow, StoredRecord } from "./record-service.ts";

export type Database = { public: {
  Tables: { game_records: {
    Row: StoredRecord;
    Insert: Omit<StoredRecord, "id" | "created_at">;
    Update: Partial<Omit<StoredRecord, "id">>;
    Relationships: [];
  } };
  Views: { leaderboard: { Row: LeaderboardRow; Relationships: [] } };
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
} };
let client: SupabaseClient<Database> | undefined;
export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on the server.");
  if (key.startsWith("sb_publishable_")) throw new Error("SUPABASE_SERVICE_ROLE_KEY must contain a server secret, not a publishable key.");
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(10000) }) },
  });
  return client;
}
