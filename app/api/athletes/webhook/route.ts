import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs'; // ensure Node runtime for OpenAI SDK

// Use service role key (server-side only!)
const supabase = createClient(
  process.env.SUPABASE_URL!,                 // e.g. https://xxxx.supabase.co
  process.env.SUPABASE_SERVICE_ROLE_KEY!     // service role key
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Optional simple secret check
function verifySecret(req: NextRequest) {
  const incoming = req.headers.get('x-webhook-secret');
  const expected = process.env.WEBHOOK_SECRET;
  return expected && incoming && incoming === expected;
}

type RowPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema?: string;
  record?: {
    id: string;
    Insta_handle?: string;
    Sport?: string;
    Location?: string;
    Followers?: number;
    About_me?: string;
    embedding?: number[] | null;
  };
};

export async function POST(req: NextRequest) {
  try {
    // (optional) verify a shared secret
    if (process.env.WEBHOOK_SECRET && !verifySecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as RowPayload;

    // Only handle INSERTs into Athletes
    if (payload.table !== 'Athletes' || payload.type !== 'INSERT' || !payload.record) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const r = payload.record;

    // If already has embedding, skip
    if (Array.isArray(r.embedding) && r.embedding.length) {
      return NextResponse.json({ ok: true, alreadyEmbedded: true });
    }

    // Build rich text for embedding
    const text = `
Name: @${r.Insta_handle ?? ''}
Sport: ${r.Sport ?? ''}
Location: ${r.Location ?? ''}
Followers: ${r.Followers ?? ''}
About me: ${r.About_me ?? ''}
    `.trim();

    // Generate embedding
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const embedding = embRes.data[0].embedding;

    // Update the row
    const { error } = await supabase
      .from('Athletes')
      .update({ embedding })
      .eq('id', r.id);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: 'DB update error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
