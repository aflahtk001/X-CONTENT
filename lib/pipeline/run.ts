import { supabase } from '../supabase';
import { AppSettings, RawArticleItem, RunLogEntry, Source } from '../types';
import { ingestHtml, ingestRss, ingestHackerNews } from './ingest';
import { normalizeArticles } from './normalize';
import { clusterArticles } from './cluster';
import { rankClustersWithLaya } from './score';
import { analyzeArticlePage } from './analyze-page';
import { generateSocialPost } from './generate';
import { assembleTweet } from './assemble';

const DEFAULT_SETTINGS: AppSettings = {
  schedule_cron: '0 */3 * * *',
  timezone: 'Asia/Kolkata',
  posts_per_run: 3,
  max_age_hours: 24,
  groq_model: 'openai/gpt-oss-120b',
  tone: 'magnetic, viral tech copywriting, high-engagement hooks, curiosity gaps, zero fluff',
  brand_hashtags: [],
  use_hacker_news: true,
  require_image: false,
};

/**
 * Loads all settings from DB or returns defaults.
 */
export async function loadSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from('Setting').select('*');
  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  const settings: any = { ...DEFAULT_SETTINGS };
  for (const item of data) {
    settings[item.key] = item.value;
  }
  return settings as AppSettings;
}

/**
 * Orchestrates a complete content generation run.
 */
export async function executeRun(trigger: 'schedule' | 'manual', options: { postsPerRun?: number } = {}): Promise<{ runId: string; status: string; postsCreated: number }> {
  const now = new Date();
  const logs: RunLogEntry[] = [];

  const addLog = (step: string, message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', sourceName?: string) => {
    const entry: RunLogEntry = {
      step,
      level,
      message,
      timestamp: new Date().toISOString(),
      sourceName,
    };
    logs.push(entry);
    console.log(`[${entry.level.toUpperCase()}] [${entry.step}] ${entry.message}`);
  };

  // 1. Concurrency Guard & Stale Lock Cleanup
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  // Mark stale runs as failed
  await supabase
    .from('Run')
    .update({ status: 'failed', finishedAt: new Date().toISOString() })
    .eq('status', 'running')
    .lt('startedAt', fifteenMinutesAgo);

  // Check if any run is currently running
  const { data: runningRuns } = await supabase
    .from('Run')
    .select('id, startedAt')
    .eq('status', 'running')
    .limit(1);

  if (runningRuns && runningRuns.length > 0) {
    throw new Error(`Another run (${runningRuns[0].id}) is currently in progress.`);
  }

  // 2. Initialize Run Record
  const { data: newRun, error: createRunError } = await supabase
    .from('Run')
    .insert({
      trigger,
      startedAt: now.toISOString(),
      status: 'running',
      articlesFetched: 0,
      postsCreated: 0,
      log: [],
    })
    .select()
    .single();

  if (createRunError || !newRun) {
    throw new Error(`Failed to create Run record in database: ${createRunError?.message}`);
  }

  const runId = newRun.id;
  addLog('init', `Starting ${trigger} run (${runId})`);

  let finalStatus: 'success' | 'partial' | 'failed' = 'success';
  let totalArticlesFetched = 0;
  let totalPostsCreated = 0;

  try {
    // 3. Load Settings & Sources
    const settings = await loadSettings();
    const effectivePostsPerRun = options.postsPerRun ?? settings.posts_per_run ?? 3;
    addLog('settings', `Loaded configuration. Posts per run: ${effectivePostsPerRun}, Model: ${settings.groq_model}`);

    const { data: sources, error: sourcesError } = await supabase
      .from('Source')
      .select('*')
      .eq('enabled', true);

    if (sourcesError || !sources || sources.length === 0) {
      addLog('sources', 'No enabled sources found.', 'warn');
    }

    const sourceWeights: Record<string, number> = {};
    for (const src of sources || []) {
      sourceWeights[src.name] = src.weight || 1.0;
    }

    // 4. Ingestion with Concurrency Limit 5
    addLog('ingest', `Ingesting from ${(sources || []).length} sources...`);
    const allRawArticles: RawArticleItem[] = [];
    const sourceList: Source[] = (sources || []) as Source[];

    const fetchSource = async (source: Source) => {
      try {
        let items: RawArticleItem[] = [];
        if (source.type === 'rss') {
          items = await ingestRss(source);
        } else {
          items = await ingestHtml(source);
        }

        addLog('ingest', `Fetched ${items.length} items from ${source.name}`, 'info', source.name);
        await supabase
          .from('Source')
          .update({ lastFetchedAt: new Date().toISOString(), lastError: null })
          .eq('id', source.id);

        return items;
      } catch (err: any) {
        addLog('ingest', `Failed to fetch source ${source.name}: ${err.message}`, 'warn', source.name);
        await supabase
          .from('Source')
          .update({ lastFetchedAt: new Date().toISOString(), lastError: err.message })
          .eq('id', source.id);
        finalStatus = 'partial';
        return [];
      }
    };

    // Run in chunks of 5
    for (let i = 0; i < sourceList.length; i += 5) {
      const chunk = sourceList.slice(i, i + 5);
      const results = await Promise.all(chunk.map((src) => fetchSource(src)));
      for (const res of results) {
        allRawArticles.push(...res);
      }
    }

    // Optional Hacker News Ingestion
    if (settings.use_hacker_news) {
      try {
        addLog('ingest', 'Fetching Hacker News frontpage signals...');
        const hnItems = await ingestHackerNews();
        addLog('ingest', `Fetched ${hnItems.length} HN items`);
        allRawArticles.push(...hnItems);
      } catch (err: any) {
        addLog('ingest', `Hacker News fetch failed: ${err.message}`, 'warn');
      }
    }

    totalArticlesFetched = allRawArticles.length;
    addLog('ingest', `Ingestion completed. Total raw articles: ${totalArticlesFetched}`);

    // 5. Normalization & Deduplication
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPosts } = await supabase
      .from('Post')
      .select('link')
      .gte('createdAt', sevenDaysAgo);

    const existingRecentUrls = new Set<string>((recentPosts || []).map((p) => p.link));

    const normalized = normalizeArticles(allRawArticles, {
      maxAgeHours: settings.max_age_hours,
      existingRecentUrls,
      now,
    });

    addLog('normalize', `Normalized & filtered: ${normalized.length} articles remain after age & deduplication checks.`);

    if (normalized.length === 0) {
      addLog('normalize', 'No articles found matching criteria.', 'warn');
      finalStatus = totalArticlesFetched > 0 ? 'partial' : 'failed';
    } else {
      // 6. Clustering
      const clusters = clusterArticles(normalized, sourceWeights, 0.35);
      addLog('cluster', `Formed ${clusters.length} story clusters.`);

      // 7. Trend Scoring & Top Selection with Laya Decision Model
      addLog('score', 'Ranking clusters with Laya Virality & Appeal Decision Model...');
      const ranked = await rankClustersWithLaya(clusters, sourceWeights, {
        maxAgeHours: settings.max_age_hours,
        postsPerRun: effectivePostsPerRun,
        now,
      });

      addLog('score', `Selected top ${ranked.length} trending clusters.`);

      // 8. Page Analysis & Groq Content Generation (Sequential with 1s delay)
      for (let idx = 0; idx < ranked.length; idx++) {
        const item = ranked[idx];
        const cluster = item.cluster;

        // Choose main article (highest weighted non-HN article)
        const nonHnArticles = cluster.articles.filter((a) => a.source !== 'Hacker News');
        const mainArticle = nonHnArticles[0] || cluster.articles[0];

        if (!mainArticle) continue;

        const categoryTag = item.layaEvaluation?.category ? `[${item.layaEvaluation.category}] ` : '';
        addLog('analyze', `Analyzing story: ${categoryTag}"${cluster.headline}" from ${mainArticle.source}`);

        try {
          // Page Analysis
          const pageAnalysis = await analyzeArticlePage(
            mainArticle.url,
            mainArticle.summary,
            mainArticle.mediaImage
          );

          // Check require_image rule
          if (settings.require_image && !pageAnalysis.imageUrl) {
            addLog('generate', `Skipping story "${cluster.headline}" because no valid image was found and require_image is ON.`, 'warn');
            continue;
          }

          // Generate post content with Groq & Laya Judge
          addLog('generate', `Generating 3 viral post candidates via Groq & ranking with Laya Judge...`);
          const generated = await generateSocialPost(cluster, pageAnalysis, {
            model: settings.groq_model,
            tone: settings.tone,
            brandHashtags: settings.brand_hashtags,
          });

          // Assemble final tweet
          const assembled = assembleTweet(generated.caption, generated.tags, mainArticle.url);

          // Save to Supabase: Cluster -> Articles -> Post
          const { data: dbCluster, error: clusterError } = await supabase
            .from('Cluster')
            .insert({
              runId,
              headline: cluster.headline,
              score: item.score,
              sourceCount: item.distinctSources,
              hnPoints: cluster.hnPoints || 0,
            })
            .select()
            .single();

          if (clusterError || !dbCluster) {
            throw new Error(`Failed to save cluster: ${clusterError?.message}`);
          }

          // Save articles
          for (const art of cluster.articles) {
            // Find or link sourceId if exists
            const matchedSource = sourceList.find((s) => s.name === art.source);
            if (matchedSource) {
              await supabase
                .from('Article')
                .upsert(
                  {
                    sourceId: matchedSource.id,
                    title: art.title,
                    url: art.url,
                    summary: art.summary,
                    publishedAt: art.publishedAt.toISOString(),
                    clusterId: dbCluster.id,
                  },
                  { onConflict: 'url' }
                );
            }
          }

          // Save Post
          const { error: postError } = await supabase.from('Post').insert({
            clusterId: dbCluster.id,
            title: generated.title,
            caption: assembled.finalCaption,
            tags: assembled.finalTags,
            imageUrl: pageAnalysis.imageUrl,
            link: mainArticle.url,
            tweetText: assembled.tweetText,
            status: 'draft',
            trendScore: item.score,
            model: settings.groq_model,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          if (postError) {
            throw new Error(`Failed to save post: ${postError.message}`);
          }

          totalPostsCreated++;
          addLog('generate', `Created post: "${generated.title}" (${assembled.tweetText.length} chars)`);

          // Rate limit pause between Groq calls
          if (idx < ranked.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (postErr: any) {
          addLog('generate', `Failed to generate post for "${cluster.headline}": ${postErr.message}`, 'warn');
          finalStatus = 'partial';
        }
      }
    }

    if (totalPostsCreated === 0 && totalArticlesFetched > 0) {
      finalStatus = 'failed';
    }
  } catch (runErr: any) {
    addLog('error', `Fatal error during run: ${runErr.message}`, 'error');
    finalStatus = 'failed';
  } finally {
    addLog('complete', `Run completed with status: ${finalStatus}. Articles: ${totalArticlesFetched}, Posts: ${totalPostsCreated}`);

    await supabase
      .from('Run')
      .update({
        finishedAt: new Date().toISOString(),
        status: finalStatus,
        articlesFetched: totalArticlesFetched,
        postsCreated: totalPostsCreated,
        log: logs,
      })
      .eq('id', runId);
  }

  return {
    runId,
    status: finalStatus,
    postsCreated: totalPostsCreated,
  };
}
