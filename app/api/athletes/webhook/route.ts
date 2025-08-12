import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';

// Helper: create clients at runtime, not module scope
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey });
}

// Optional GET probe so you can hit the route in a browser and see it’s live
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/athletes/webhook' }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    // (Optional) shared-secret check
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const incoming = req.headers.get('x-webhook-secret');
      if (incoming !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = await req.json();
    // Only handle INSERT on Athletes
    if (!payload || payload.table !== 'Athletes' || payload.type !== 'INSERT' || !payload.record) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = getSupabaseAdmin();
    const openai = getOpenAI();

    const r = payload.record;

    // Build text to embed
    const text = `
Name: @${r.Insta_handle ?? ''}
Sport: ${r.Sport ?? ''}
Location: ${r.Location ?? ''}
Followers: ${r.Followers ?? ''}
About me: ${r.About_me ?? ''}
`.trim();

    if (!text.replace(/\s/g, '')) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    // Create embedding
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const embedding = embRes.data?.[0]?.embedding;
    if (!embedding) {
      return NextResponse.json({ error: 'No embedding returned' }, { status: 500 });
    }

    // Update row
    const { error } = await supabase
      .from('Athletes')
      .update({ embedding })
      .eq('id', r.id);

    if (error) {
      return NextResponse.json({ error: 'DB update error: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
