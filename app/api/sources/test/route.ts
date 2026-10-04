import { NextRequest, NextResponse } from 'next/server';
import { ingestHtml, ingestRss, discoverFeed } from '@/lib/pipeline/ingest';
import { Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

// POST /api/sources/test - Test and preview items from arbitrary URL / config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { url, type, selectors, name } = body;

    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    url = url.trim();

    // If auto or rss, test auto-discovery if needed
    if (!type || type === 'auto') {
      const discovered = await discoverFeed(url);
      if (discovered) {
        url = discovered.feedUrl;
        type = discovered.type;
      } else {
        type = 'rss';
      }
    }

    const testSource: Source = {
      id: 'test',
      name: name || 'Test Source',
      type: type || 'rss',
      url,
      enabled: true,
      weight: 1.0,
      selectors,
      createdAt: new Date().toISOString(),
    };

    const items = testSource.type === 'rss' ? await ingestRss(testSource) : await ingestHtml(testSource);

    return NextResponse.json({
      success: true,
      discoveredFeedUrl: url,
      count: items.length,
      preview: items.slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
