import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/posts - List posts with pagination and status filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('Post')
      .select('*, cluster:Cluster(*, articles:Article(*, source:Source(*)))', { count: 'exact' })
      .order('createdAt', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: posts, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format response to include coveredBy source names list
    const formatted = (posts || []).map((post: any) => {
      const articles = post.cluster?.articles || [];
      const coveredBy = Array.from(
        new Set(
          articles
            .map((a: any) => a.source?.name || a.source || 'News')
            .filter(Boolean)
        )
      );

      return {
        id: post.id,
        status: post.status,
        title: post.title,
        caption: post.caption,
        tags: Array.isArray(post.tags) ? post.tags : JSON.parse(post.tags || '[]'),
        imageUrl: post.imageUrl,
        link: post.link,
        tweetText: post.tweetText,
        trendScore: post.trendScore,
        model: post.model,
        coveredBy: coveredBy.length > 0 ? coveredBy : ['Web'],
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        postedAt: post.postedAt,
        cluster: post.cluster,
      };
    });

    return NextResponse.json(
      {
        posts: formatted,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
