import { describe, it, expect } from 'vitest';
import { calculateClusterScore } from '../lib/pipeline/score';
import { ClusteredStory } from '../lib/pipeline/cluster';

describe('Trend Scoring Algorithm', () => {
  const now = new Date('2026-09-29T12:00:00Z');

  it('ranks multi-source story higher than single-source story', () => {
    const singleSourceCluster: ClusteredStory = {
      headline: 'Single outlet exclusive',
      tokens: new Set(['exclusive']),
      articles: [
        {
          source: 'Outlet A',
          title: 'Single outlet exclusive',
          url: 'https://outlet-a.com/1',
          publishedAt: new Date('2026-09-29T11:00:00Z'),
        },
      ],
      hnPoints: 0,
    };

    const multiSourceCluster: ClusteredStory = {
      headline: 'Major breaking tech story',
      tokens: new Set(['major', 'breaking']),
      articles: [
        {
          source: 'Outlet A',
          title: 'Major breaking tech story',
          url: 'https://outlet-a.com/2',
          publishedAt: new Date('2026-09-29T11:00:00Z'),
        },
        {
          source: 'Outlet B',
          title: 'Major breaking tech story covered',
          url: 'https://outlet-b.com/2',
          publishedAt: new Date('2026-09-29T11:00:00Z'),
        },
        {
          source: 'Outlet C',
          title: 'Breaking news on tech',
          url: 'https://outlet-c.com/2',
          publishedAt: new Date('2026-09-29T11:00:00Z'),
        },
      ],
      hnPoints: 0,
    };

    const singleScore = calculateClusterScore(singleSourceCluster, {}, { now });
    const multiScore = calculateClusterScore(multiSourceCluster, {}, { now });

    expect(multiScore.totalScore).toBeGreaterThan(singleScore.totalScore);
    expect(multiScore.distinctSourceCount).toBe(3);
    expect(singleScore.distinctSourceCount).toBe(1);
  });

  it('incorporates source weights and Hacker News points properly', () => {
    const clusterWithHn: ClusteredStory = {
      headline: 'HN viral story',
      tokens: new Set(['viral']),
      articles: [
        {
          source: 'HighWeightSite',
          title: 'HN viral story',
          url: 'https://highweight.com/viral',
          publishedAt: new Date('2026-09-29T11:00:00Z'),
        },
      ],
      hnPoints: 250,
    };

    const score = calculateClusterScore(clusterWithHn, { HighWeightSite: 2.0 }, { now });
    // 3.0 * 2.0 (sourceScore = 6.0) + hnScore (2.5) + recency (~1.9)
    expect(score.sourceScore).toBe(6.0);
    expect(score.hnScore).toBe(2.5);
    expect(score.totalScore).toBeGreaterThan(10.0);
  });
});
