import { describe, it, expect } from 'vitest';
import { clusterArticles, tokenizeTitle, jaccardSimilarity } from '../lib/pipeline/cluster';
import { RawArticleItem } from '../lib/types';

describe('Story Clustering & Tokenization', () => {
  it('tokenizes title removing stopwords and short tokens', () => {
    const tokens = tokenizeTitle('OpenAI launches a brand new reasoning model for coding');
    expect(tokens.has('openai')).toBe(true);
    expect(tokens.has('reasoning')).toBe(true);
    expect(tokens.has('model')).toBe(true);
    expect(tokens.has('coding')).toBe(true);
    expect(tokens.has('a')).toBe(false);
    expect(tokens.has('for')).toBe(false);
  });

  it('groups near-identical headlines from different outlets into one cluster', () => {
    const items: RawArticleItem[] = [
      {
        source: 'TechCrunch',
        title: 'OpenAI announces new reasoning AI model GPT-5',
        url: 'https://techcrunch.com/openai-gpt5',
        publishedAt: new Date(),
      },
      {
        source: 'The Verge',
        title: 'OpenAI reveals reasoning AI model GPT-5 with major coding speedup',
        url: 'https://theverge.com/openai-gpt5-launch',
        publishedAt: new Date(),
      },
      {
        source: 'Ars Technica',
        title: 'OpenAI launches new reasoning model GPT-5',
        url: 'https://arstechnica.com/openai-gpt-5',
        publishedAt: new Date(),
      },
      {
        source: 'Wired',
        title: 'Tesla announces new cybercab robotaxi in California',
        url: 'https://wired.com/tesla-robotaxi',
        publishedAt: new Date(),
      },
    ];

    const clusters = clusterArticles(items, { TechCrunch: 1.5 });
    expect(clusters.length).toBe(2);

    const openaiCluster = clusters.find((c) => c.headline.toLowerCase().includes('openai'));
    expect(openaiCluster).toBeDefined();
    expect(openaiCluster?.articles.length).toBe(3);

    const teslaCluster = clusters.find((c) => c.headline.toLowerCase().includes('tesla'));
    expect(teslaCluster).toBeDefined();
    expect(teslaCluster?.articles.length).toBe(1);
  });
});
