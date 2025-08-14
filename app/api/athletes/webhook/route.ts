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
  // Safe stringifier that handles null/undefined
  const s = (v: any) => (v === null || v === undefined ? '' : String(v));

  if (record && typeof record.embedding_source === 'string' && record.embedding_source.trim() !== '') {
    return record.embedding_source.trim();
  }

  const parts = [
    s(record?.location),
    s(record?.sport),
    s(record?.about_me),
    'Followers: ' + s(record?.followers),
  ];

  return parts.join(' | ').trim();
}
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, record } = payload as {
      type: 'INSERT' | 'UPDATE' | 'DELETE';
      table: string;
      record: any;
      schema: string;
      old_record?: any;
    };

    if (!record?.id) return NextResponse.json({ ok: true, skipped: 'no record' });
    if (type !== 'INSERT' && type !== 'UPDATE') {
      return NextResponse.json({ ok: true, skipped: 'event not handled' });
    }

    const supabase = getSupabaseAdmin();

    // 🔎 Debug: verify role/JWT once
    const { data: whoamiData, error: whoamiError } = await supabase.rpc('whoami');
    console.log('whoami ->', JSON.stringify(whoamiData), whoamiError);

    const text = await buildEmbeddingInput(record);
    if (!text) return NextResponse.json({ ok: true, skipped: 'empty text' });

    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const vector = emb.data[0].embedding;

    // 🔒 Hardcode your actual table name to avoid casing issues
    const TABLE = 'Athletes'; // use 'athletes' if the table was created unquoted/lowercase
    const { error } = await supabase.from(TABLE).update({ embedding: vector }).eq('id', record.id);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'unknown' }, { status: 500 });
  }
