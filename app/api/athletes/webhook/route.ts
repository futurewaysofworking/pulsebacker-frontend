import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service role bypasses RLS
  return createClient(url, key);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function buildEmbeddingInput(record: any) {
  // Prefer the prebuilt helper if present; else concatenate here
  const text =
    record.embedding_source ??
    [
      record.location ?? '',
      record.sport ?? '',
      record.about_me ?? '',
      `Followers: ${record.followers ?? ''}`,
    ].join(' | ')
  ).trim();
}
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    // Supabase DB Webhooks payload shape:
    // { type: 'INSERT'|'UPDATE'|'DELETE', table: 'athletes', record, schema, old_record? }

    const { type, record, table } = payload as {
      type: string;
      table: string;
      record: any;
      schema: string;
      old_record?: any;
    };

    if (!record || !record.id) {
      return NextResponse.json({ ok: true, skipped: 'no record' });
    }

    const r = payload.record;

    // Only act on INSERT or on UPDATEs to the watched columns
    if (type !== 'INSERT' && type !== 'UPDATE') {
      return NextResponse.json({ ok: true, skipped: 'event not handled' });
    }

    const supabase = getSupabaseAdmin();

    // 🔎 Debug: verify role/JWT once
    const { data: whoamiData, error: whoamiError } = await supabase.rpc('whoami');
    console.log('whoami ->', JSON.stringify(whoamiData), whoamiError);

    const text = await buildEmbeddingInput(record);
    if (!text) return NextResponse.json({ ok: true, skipped: 'empty text' });

    // Call OpenAI embeddings (replace model if you use another)
    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    //debugging
    const supabase = getSupabaseAdmin();
    const who = await supabase.rpc('whoami');           // <-- diagnostic
    console.log('whoami ->', JSON.stringify(who.data), who.error);
    const vector = emb.data[0].embedding;

    // Write back
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(table)            // "athletes"
      .update({ embedding: vector })
      .eq('id', record.id);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'unknown' }, { status: 500 });
  }
}
whoami -> {
  "db_role": "service_role",
  "uid": null,
  "claims": { ... }
}
