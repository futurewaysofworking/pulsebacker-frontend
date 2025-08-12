// lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Use ONLY in client components (browser).
 * It reads NEXT_PUBLIC_* envs and throws a helpful error if missing.
 */
export function getBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add them to .env.local for local dev and Vercel Project → Settings → Environment Variables for deploys.'
    );
  }

  return createClient(url, anon);
}
