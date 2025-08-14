import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // avoid any prerendering/caching for this route

// --- Helpers: create clients at runtime (not module scope) ---
function getSupabaseAdmin(): SupabaseClient {
  // Prefer server-only var; fall back to public URL if not set
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role key (server-only)
  if (!url || !key) {
    throw new Error(
      'Missing Supabase envs: require SUPABASE_SERVICE_ROLE_KEY and URL (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL).'
    );
  }
  return createClient(url, key);
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey });
}

function buildText(r: any) {
  return `
Name: @${r?.Insta_handle ?? ''}
Sport: ${r?.Sport ?? ''}
Location: ${r?.Location ?? ''}
Followers: ${r?.Followers ?? ''}
About me: ${r?.About_me ?? ''}
`.trim();
}

// --- Optional GET probe so you can test in the browser ---
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/athletes/webhook' }, { status: 200 });
}

// --- Webhook handler ---
export async function POST(req: NextRequest) {
  try {
    // Optional shared-secret verification
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const incoming = req.headers.get('x-webhook-secret');
      if (incoming !== secret) {
        console.error('Unauthorized webhook (bad secret)');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = await req.json().catch(() => null);
    if (!payload || payload.table !== 'Athletes' || !payload.record) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Handle INSERTs (and UPDATEs if you enable this)
    const isInsert = payload.type === 'INSERT';
    const isUpdate = payload.type === 'UPDATE'; // add an UPDATE webhook in Supabase if you want re-embed on edits
    if (!isInsert && !isUpdate) {
      return NextResponse.json({ ok: true, ignored: 'not insert/update' });
    }

    const r = payload.record;

    // If embedding exists and it's an INSERT, skip. For UPDATE, re-embed if you want fresher vectors.
    if (isInsert && Array.isArray(r.embedding) && r.embedding.length) {
      return NextResponse.json({ ok: true, alreadyEmbedded: true });
    }

    const text = buildText(r);
    if (!text.replace(/\s/g, '')) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    const openai = getOpenAI();
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const embedding = embRes.data?.[0]?.embedding;
    if (!embedding) {
      console.error('No embedding returned from OpenAI');
      return NextResponse.json({ error: 'No embedding returned' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('Athletes')
      .update({ embedding })
      .eq('id', r.id);

    if (error) {
      console.error('DB update error:', error);
      return NextResponse.json({ error: 'DB update error: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reembedded: isUpdate || undefined });
  } catch (e: any) {
    console.error('Webhook fatal:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
