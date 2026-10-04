import { describe, it, expect, vi } from 'vitest';
import { extractCandidatePosts, sanitizeGeneratedContent } from '../lib/pipeline/generate';
import { evaluateCandidatesWithLaya, evaluateStoryWithLaya } from '../lib/laya';

describe('Laya Candidate Parsing and Decision Helpers', () => {
  it('parses multi-candidate JSON response from Groq', () => {
    const rawMulti = {
      candidates: [
        {
          title: 'Candidate 1: Major AI Discovery',
          caption: 'Why did OpenAI change their architecture? The results surprised everyone.',
          tags: ['#AI', '#Tech'],
        },
        {
          title: 'Candidate 2: The Breakthrough No One Saw Coming',
          caption: 'Everything we thought we knew about reasoning models was wrong.',
          tags: ['#AI', '#MachineLearning'],
        },
      ],
    };

    const extracted = extractCandidatePosts(rawMulti);
    expect(extracted).toHaveLength(2);
    expect(extracted[0].title).toBe('Candidate 1: Major AI Discovery');
    expect(extracted[1].caption).toContain('Everything we thought');
  });

  it('parses single candidate JSON fallback seamlessly', () => {
    const rawSingle = {
      title: 'Single Candidate Title',
      caption: 'Single candidate caption here.',
      tags: ['#Tech'],
    };

    const extracted = extractCandidatePosts(rawSingle);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].title).toBe('Single Candidate Title');
  });

  it('evaluates candidates with Laya when available or falls back gracefully', async () => {
    // When offline / unreachable URL, should gracefully return null
    const result = await evaluateCandidatesWithLaya(
      'Story summary',
      [
        { title: 'A', caption: 'Hook A', tags: ['#A'] },
        { title: 'B', caption: 'Hook B', tags: ['#B'] },
      ],
      'http://127.0.0.1:9999' // non-existent port
    );

    expect(result).toBeNull();
  });

  it('handles single candidate without HTTP request', async () => {
    const single = [{ title: 'Solo', caption: 'Solo Caption', tags: ['#Solo'] }];
    const result = await evaluateCandidatesWithLaya('Story', single, 'http://127.0.0.1:9999');
    expect(result?.bestIndex).toBe(0);
    expect(result?.bestCandidate.title).toBe('Solo');
  });
});
