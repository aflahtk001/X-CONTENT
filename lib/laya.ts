/**
 * Client interface for the local Laya Decision Engine (convaiinnovations/laya).
 */

export interface LayaStoryEvaluation {
  compositeViralityScore: number;
  category: string;
  categoryConfidence: number;
  viralityScore: number;
  curiosityScore: number;
  details?: Record<string, any>;
}

export interface PostCandidateItem {
  title: string;
  caption: string;
  tags: string[];
}

export interface EvaluatedCandidate {
  index: number;
  candidate: PostCandidateItem;
  qualityScore: number;
  hookScore: number;
  ctrScore: number;
  confidence?: number;
}

export interface LayaCandidateEvaluation {
  bestIndex: number;
  bestCandidate: PostCandidateItem;
  bestScore: number;
  rankedCandidates: EvaluatedCandidate[];
}

const DEFAULT_LAYA_URL = process.env.LAYA_API_URL || 'http://127.0.0.1:8000';

/**
 * Checks if the local Laya decision server is active and healthy.
 */
export async function checkLayaHealth(apiUrl = DEFAULT_LAYA_URL): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ready === true || data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Evaluates the virality, curiosity gap, and category of a story using Laya.
 */
export async function evaluateStoryWithLaya(
  story: { headline: string; description?: string; body?: string },
  apiUrl = DEFAULT_LAYA_URL
): Promise<LayaStoryEvaluation | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    
    const res = await fetch(`${apiUrl}/evaluate-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: story.headline,
        description: story.description || '',
        body: (story.body || '').slice(0, 1000),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`Laya evaluate-story returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return {
      compositeViralityScore: data.composite_virality_score ?? 0.5,
      category: data.category ?? 'general_tech',
      categoryConfidence: data.category_confidence ?? 0.5,
      viralityScore: data.virality_score ?? 0.5,
      curiosityScore: data.curiosity_score ?? 0.5,
      details: data.details,
    };
  } catch (err: any) {
    console.warn(`Laya evaluateStory skipped (server unreachable or timed out): ${err.message}`);
    return null;
  }
}

/**
 * Evaluates multiple copywriting candidate variations using Laya and returns the best-ranked post.
 */
export async function evaluateCandidatesWithLaya(
  storySummary: string,
  candidates: PostCandidateItem[],
  apiUrl = DEFAULT_LAYA_URL
): Promise<LayaCandidateEvaluation | null> {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) {
    return {
      bestIndex: 0,
      bestCandidate: candidates[0],
      bestScore: 1.0,
      rankedCandidates: [
        {
          index: 0,
          candidate: candidates[0],
          qualityScore: 1.0,
          hookScore: 1.0,
          ctrScore: 1.0,
        },
      ],
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${apiUrl}/evaluate-candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_summary: storySummary.slice(0, 800),
        candidates,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`Laya evaluate-candidates returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return {
      bestIndex: data.best_index ?? 0,
      bestCandidate: data.best_candidate ?? candidates[0],
      bestScore: data.best_score ?? 0.5,
      rankedCandidates: (data.ranked_candidates || []).map((rc: any) => ({
        index: rc.index,
        candidate: rc.candidate,
        qualityScore: rc.quality_score,
        hookScore: rc.hook_score,
        ctrScore: rc.ctr_score,
        confidence: rc.confidence,
      })),
    };
  } catch (err: any) {
    console.warn(`Laya evaluateCandidates skipped: ${err.message}`);
    return null;
  }
}
