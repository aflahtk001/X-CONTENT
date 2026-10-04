import { ClusteredStory } from './cluster';
import { evaluateStoryWithLaya, LayaStoryEvaluation } from '../laya';

export interface ScoreDetails {
  totalScore: number;
  distinctSourceCount: number;
  sourceScore: number;
  hnScore: number;
  recencyScore: number;
  layaScore?: number;
  layaCategory?: string;
}

export interface RankedClusterItem {
  cluster: ClusteredStory;
  score: number;
  distinctSources: number;
  layaEvaluation?: LayaStoryEvaluation | null;
}

/**
 * Computes trend score for a cluster based on:
 * - Distinct sources weight (multiplier 3.0)
 * - Hacker News points (hnPoints / 100)
 * - Recency bonus: max(0, 2 * (1 - ageHours / maxAgeHours))
 */
export function calculateClusterScore(
  cluster: ClusteredStory,
  sourceWeights: Record<string, number> = {},
  options: {
    maxAgeHours?: number;
    now?: Date;
  } = {}
): ScoreDetails {
  const maxAgeHours = options.maxAgeHours ?? 24;
  const now = options.now ?? new Date();

  // 1. Distinct sources
  const distinctSources = new Set<string>();
  let sourceWeightSum = 0;

  for (const article of cluster.articles) {
    if (article.source !== 'Hacker News' && !distinctSources.has(article.source)) {
      distinctSources.add(article.source);
      const weight = sourceWeights[article.source] ?? 1.0;
      sourceWeightSum += weight;
    }
  }

  // If only Hacker news was in cluster
  if (distinctSources.size === 0 && cluster.articles.length > 0) {
    distinctSources.add('Hacker News');
    sourceWeightSum = 0.5;
  }

  const sourceScore = 3.0 * sourceWeightSum;

  // 2. Hacker News points
  const hnScore = cluster.hnPoints / 100;

  // 3. Recency of newest item
  let newestTimestamp = 0;
  for (const article of cluster.articles) {
    const t = article.publishedAt.getTime();
    if (!isNaN(t) && t > newestTimestamp) {
      newestTimestamp = t;
    }
  }

  const ageMs = Math.max(0, now.getTime() - newestTimestamp);
  const ageHours = ageMs / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 2.0 * (1.0 - ageHours / maxAgeHours));

  const totalScore = parseFloat((sourceScore + hnScore + recencyScore).toFixed(2));

  return {
    totalScore,
    distinctSourceCount: distinctSources.size,
    sourceScore,
    hnScore,
    recencyScore,
  };
}

/**
 * Ranks clustered stories by trend score descending.
 */
export function rankClusters(
  clusters: ClusteredStory[],
  sourceWeights: Record<string, number> = {},
  options: { maxAgeHours?: number; postsPerRun?: number; now?: Date } = {}
): RankedClusterItem[] {
  const postsPerRun = options.postsPerRun ?? 3;

  const scored = clusters.map((cluster) => {
    const { totalScore, distinctSourceCount } = calculateClusterScore(cluster, sourceWeights, options);
    return {
      cluster,
      score: totalScore,
      distinctSources: distinctSourceCount,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, postsPerRun);
}

/**
 * Enhanced ranking that leverages Laya Decision Model to evaluate virality & curiosity gap.
 */
export async function rankClustersWithLaya(
  clusters: ClusteredStory[],
  sourceWeights: Record<string, number> = {},
  options: {
    maxAgeHours?: number;
    postsPerRun?: number;
    now?: Date;
    layaApiUrl?: string;
  } = {}
): Promise<RankedClusterItem[]> {
  const postsPerRun = options.postsPerRun ?? 3;

  // 1. Initial heuristic ranking to pick top candidates (2x pool size for Laya evaluation)
  const poolSize = Math.max(postsPerRun * 2, 6);
  const initialRanked = rankClusters(clusters, sourceWeights, {
    ...options,
    postsPerRun: poolSize,
  });

  if (initialRanked.length === 0) return [];

  // 2. Evaluate candidate clusters with Laya decision model in parallel
  const evaluatedItems: RankedClusterItem[] = await Promise.all(
    initialRanked.map(async (item) => {
      const mainArticle = item.cluster.articles[0];
      const layaEval = await evaluateStoryWithLaya(
        {
          headline: item.cluster.headline,
          description: mainArticle?.summary || '',
          body: '',
        },
        options.layaApiUrl
      );

      let adjustedScore = item.score;
      if (layaEval) {
        // Boost score based on Laya virality (0.0 to 1.0 scaled to +0 to +5 points)
        adjustedScore = parseFloat((item.score + layaEval.compositeViralityScore * 5.0).toFixed(2));
      }

      return {
        cluster: item.cluster,
        score: adjustedScore,
        distinctSources: item.distinctSources,
        layaEvaluation: layaEval,
      };
    })
  );

  // 3. Sort by adjusted score descending and return top postsPerRun
  evaluatedItems.sort((a, b) => b.score - a.score);
  return evaluatedItems.slice(0, postsPerRun);
}

