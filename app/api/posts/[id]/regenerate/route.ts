import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadSettings } from '@/lib/pipeline/run';
import { analyzeArticlePage } from '@/lib/pipeline/analyze-page';
import { generateSocialPost } from '@/lib/pipeline/generate';
import { assembleTweet } from '@/lib/pipeline/assemble';
import { ClusteredStory } from '@/lib/pipeline/cluster';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const customInstruction = body.instruction || body.customInstruction;

    // Fetch existing post + cluster
    const { data: post, error: findError } = await supabase
      .from('Post')
      .select('*, cluster:Cluster(*, articles:Article(*, source:Source(*)))')
      .eq('id', id)
      .single();

    if (findError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const clusterData = post.cluster;
    if (!clusterData) {
      return NextResponse.json({ error: 'Associated cluster not found' }, { status: 404 });
    }

    const settings = await loadSettings();

    // Map articles to cluster structure
    const articles = clusterData.articles || [];
    const mainArticle = articles.find((a: any) => a.url === post.link) || articles[0];

    const clusterStory: ClusteredStory = {
      headline: clusterData.headline,
      tokens: new Set(),
      articles: articles.map((a: any) => ({
        source: a.source?.name || a.source || 'News',
        title: a.title,
        url: a.url,
        summary: a.summary,
        publishedAt: new Date(a.publishedAt || Date.now()),
      })),
      hnPoints: clusterData.hnPoints || 0,
    };

    // Analyze article page
    const pageAnalysis = await analyzeArticlePage(
      mainArticle ? mainArticle.url : post.link,
      mainArticle?.summary,
      post.imageUrl
    );

    // Call Groq with temperature 0.9 and custom instruction
    const generated = await generateSocialPost(clusterStory, pageAnalysis, {
      model: settings.groq_model,
      tone: settings.tone,
      brandHashtags: settings.brand_hashtags,
      customInstruction,
      temperature: 0.9,
    });

    // Assemble new tweet
    const assembled = assembleTweet(generated.caption, generated.tags, post.link);

    // Update Post
    const { data: updatedPost, error: updateError } = await supabase
      .from('Post')
      .update({
        title: generated.title,
        caption: assembled.finalCaption,
        tags: assembled.finalTags,
        tweetText: assembled.tweetText,
        imageUrl: pageAnalysis.imageUrl || post.imageUrl,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, cluster:Cluster(*, articles:Article(*, source:Source(*)))')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Post regenerated successfully',
      post: updatedPost,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
