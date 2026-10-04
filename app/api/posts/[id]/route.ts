import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { assembleTweet } from '@/lib/pipeline/assemble';

export const dynamic = 'force-dynamic';

// GET /api/posts/:id - Post detail with cluster and articles
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const { data: post, error } = await supabase
      .from('Post')
      .select('*, cluster:Cluster(*, articles:Article(*, source:Source(*)))')
      .eq('id', id)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const articles = post.cluster?.articles || [];
    const coveredBy = Array.from(
      new Set(
        articles
          .map((a: any) => a.source?.name || a.source || 'News')
          .filter(Boolean)
      )
    );

    const formatted = {
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

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/posts/:id - Edit post fields and recompute tweetText
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Fetch existing post
    const { data: existing, error: findError } = await supabase
      .from('Post')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const title = body.title !== undefined ? body.title : existing.title;
    const caption = body.caption !== undefined ? body.caption : existing.caption;
    const tags = body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : existing.tags;
    const imageUrl = body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl;
    const status = body.status !== undefined ? body.status : existing.status;
    const postedAt = status === 'posted' && !existing.postedAt ? new Date().toISOString() : existing.postedAt;

    // Recompute tweet text
    const { tweetText, finalCaption, finalTags } = assembleTweet(caption, tags, existing.link);

    const updatePayload: any = {
      title,
      caption: finalCaption,
      tags: finalTags,
      imageUrl,
      status,
      tweetText,
      postedAt,
      updatedAt: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from('Post')
      .update(updatePayload)
      .eq('id', id)
      .select('*, cluster:Cluster(*, articles:Article(*, source:Source(*)))')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/posts/:id - Delete post
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { error } = await supabase.from('Post').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
