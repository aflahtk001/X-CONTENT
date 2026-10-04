import { RawArticleItem } from '../types';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just', 'll', 'm',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she',
  'should', 'so', 'some', 'such', 't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
  'very', 'was', 'wasn', 'we', 'were', 'weren', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'will', 'with', 'won', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'says', 'said', 'new', 'first', 'update', 'launch', 'launches', 'report', 'reports', 'show', 'shows',
]);

/**
 * Tokenizes a title into a set of normalized alphanumeric tokens, excluding stop words and len < 3.
 */
export function tokenizeTitle(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard similarity between two sets of tokens.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export interface ClusteredStory {
  headline: string;
  tokens: Set<string>;
  articles: RawArticleItem[];
  hnPoints: number;
}

/**
 * Clusters articles into stories using token Jaccard similarity >= threshold (default 0.35).
 */
export function clusterArticles(
  items: RawArticleItem[],
  sourceWeights: Record<string, number> = {},
  threshold = 0.35
): ClusteredStory[] {
  const clusters: ClusteredStory[] = [];

  for (const item of items) {
    const itemTokens = tokenizeTitle(item.title);
    let bestCluster: ClusteredStory | null = null;
    let bestSim = 0;

    for (const cluster of clusters) {
      const sim = jaccardSimilarity(itemTokens, cluster.tokens);
      if (sim >= threshold && sim > bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.articles.push(item);
      if (item.source === 'Hacker News') {
        bestCluster.hnPoints += item.points || 0;
      }
      // Merge tokens into cluster
      for (const t of itemTokens) {
        bestCluster.tokens.add(t);
      }
    } else {
      clusters.push({
        headline: item.title,
        tokens: new Set(itemTokens),
        articles: [item],
        hnPoints: item.source === 'Hacker News' ? item.points || 0 : 0,
      });
    }
  }

  // Determine representative headline for each cluster
  for (const cluster of clusters) {
    const nonHnArticles = cluster.articles.filter((a) => a.source !== 'Hacker News');
    const pool = nonHnArticles.length > 0 ? nonHnArticles : cluster.articles;

    // Pick article with highest weight * recency
    let topArticle = pool[0];
    let topScore = -1;

    for (const art of pool) {
      const weight = sourceWeights[art.source] ?? 1.0;
      const recency = art.publishedAt.getTime();
      const score = weight * 1000000000000 + recency;
      if (score > topScore) {
        topScore = score;
        topArticle = art;
      }
    }

    cluster.headline = topArticle.title;
  }

  return clusters;
}
