// lib/supabaseServer.ts (server-only)
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}
