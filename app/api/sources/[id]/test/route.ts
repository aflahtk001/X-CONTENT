import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ingestHtml, ingestRss } from '@/lib/pipeline/ingest';
import { Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

// POST /api/sources/:id/test - Test and preview items from an existing source
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { data: source, error } = await supabase.from('Source').select('*').eq('id', id).single();

    if (error || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const items = source.type === 'rss' ? await ingestRss(source as Source) : await ingestHtml(source as Source);

    return NextResponse.json({
      success: true,
      count: items.length,
      preview: items.slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
