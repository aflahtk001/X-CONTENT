import { describe, it, expect } from 'vitest';
import { canonicalizeUrl, normalizeArticles } from '../lib/pipeline/normalize';
import { RawArticleItem } from '../lib/types';

describe('URL Canonicalization & Normalization', () => {
  it('strips tracking parameters, hash fragments, and trailing slashes', () => {
    const raw = 'https://example.com/tech/new-chip/?utm_source=twitter&utm_medium=social&fbclid=123#comments';
    const clean = canonicalizeUrl(raw);
    expect(clean).toBe('https://example.com/tech/new-chip');
  });

  it('preserves query parameters that are not tracking tags', () => {
    const raw = 'https://example.com/search?q=ai&utm_campaign=spring';
    const clean = canonicalizeUrl(raw);
    expect(clean).toBe('https://example.com/search?q=ai');
  });

  it('filters out duplicates and articles older than max_age_hours', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    const items: RawArticleItem[] = [
      {
        source: 'Site A',
        title: 'Recent AI Story',
        url: 'https://sitea.com/story1?utm_source=rss',
        publishedAt: new Date('2026-09-29T10:00:00Z'),
      },
      {
        source: 'Site B',
        title: 'Recent AI Story Duplicate',
        url: 'https://sitea.com/story1', // Same canonical URL
        publishedAt: new Date('2026-09-29T09:00:00Z'),
      },
      {
        source: 'Site C',
        title: 'Very Old Story',
        url: 'https://sitec.com/old-story',
        publishedAt: new Date('2026-09-27T00:00:00Z'), // > 24h old
      },
    ];

    const normalized = normalizeArticles(items, { maxAgeHours: 24, now });
    expect(normalized.length).toBe(1);
    expect(normalized[0].title).toBe('Recent AI Story');
    expect(normalized[0].url).toBe('https://sitea.com/story1');
  });
});
