import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { discoverFeed } from '@/lib/pipeline/ingest';

export const dynamic = 'force-dynamic';

// GET /api/sources - List all sources
export async function GET() {
  try {
    const { data: sources, error } = await supabase
      .from('Source')
      .select('*')
      .order('createdAt', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sources: sources || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/sources - Add source with auto-discovery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { name, url, type, weight, enabled, selectors } = body;

    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    url = url.trim();

    // Auto-discover feed if type not explicitly html or if discovery is requested
    if (!type || type === 'auto' || type === 'rss') {
      const discovered = await discoverFeed(url);
      if (discovered) {
        url = discovered.feedUrl;
        type = discovered.type;
        if (!name && discovered.title) {
          name = discovered.title.trim();
        }
      } else if (!type || type === 'auto') {
        type = 'rss'; // Default attempt
      }
    }

    if (!name || !name.trim()) {
      try {
        const parsedUrl = new URL(url);
        name = parsedUrl.hostname.replace(/^www\./, '');
      } catch {
        name = 'New Source';
      }
    }

    const { data: source, error } = await supabase
      .from('Source')
      .insert({
        name: name.trim(),
        url,
        type: type || 'rss',
        weight: weight !== undefined ? parseFloat(weight) : 1.0,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
        selectors: selectors || null,
        createdAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ source });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
