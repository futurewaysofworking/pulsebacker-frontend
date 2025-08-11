import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Setup Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Setup OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    // Create embedding of the prompt
    const embeddingRes = await openai.embeddings.create({
      input: prompt,
      model: 'text-embedding-3-small',
    });

    const promptEmbedding = embeddingRes.data[0].embedding;

    // Match using Supabase vector search
    const { data, error } = await supabase.rpc('match_athletes', {
      query_embedding: promptEmbedding,
      match_count: 5,
    });

    if (error) {
      console.error('Supabase function error:', error);
      return NextResponse.json({ error: 'Matching error' }, { status: 500 });
    }

    return NextResponse.json({ matches: data });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
