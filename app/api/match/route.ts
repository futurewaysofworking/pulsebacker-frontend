import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // don't prerender this route

// Create clients at request time (prevents "supabaseKey is required" at build)
function getSupabaseAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anon);
}

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey: key });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = (body?.prompt ?? '').toString().trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const openai = getOpenAI();
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: prompt,
    });
    const queryEmbedding = embRes.data?.[0]?.embedding;
    if (!queryEmbedding) {
      return NextResponse.json({ error: 'Failed to create embedding' }, { status: 500 });
    }

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.rpc('match_athletes', {
      query_embedding: queryEmbedding,
      match_count: 5,
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json({ error: 'Matching error: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ matches: Array.isArray(data) ? data : [] }, { status: 200 });
  } catch (e: any) {
    console.error('API /api/match error:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

