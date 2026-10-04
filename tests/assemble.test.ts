import { describe, it, expect } from 'vitest';
import { assembleTweet, computeTweetLength, X_URL_LENGTH } from '../lib/pipeline/assemble';

describe('Tweet Assembly & Character Limit Enforcement', () => {
  it('counts URL as 23 characters exactly', () => {
    const caption = 'Short test hook';
    const tags = ['#AI', '#Tech'];
    const link = 'https://very-very-long-domain-name-with-deep-parameters.com/article/1234567890';

    const calculated = computeTweetLength(caption, tags, link);
    // caption (15) + "\n\n" + tags (9) + "\n" + 23 = 49
    expect(calculated).toBe(15 + 2 + 9 + 1 + X_URL_LENGTH);
  });

  it('drops hashtags before trimming caption when text exceeds 280 characters', () => {
    const caption = 'A'.repeat(220); // 220 chars
    const tags = ['#TagOne', '#TagTwo', '#TagThree', '#TagFour', '#TagFive']; // ~45 chars
    const link = 'https://example.com/article'; // 23 chars + \n = 24 chars
    // Total raw ~ 220 + 2 + 45 + 24 = 291 > 280

    const { tweetText, finalTags } = assembleTweet(caption, tags, link);
    const finalLen = computeTweetLength(caption, finalTags, link);

    expect(finalLen).toBeLessThanOrEqual(280);
    expect(finalTags.length).toBeLessThan(tags.length);
    expect(tweetText).toContain('https://example.com/article');
  });

  it('shortens caption if even with 0 hashtags length exceeds 280 characters', () => {
    const superLongCaption = 'word '.repeat(70); // 350 chars
    const tags: string[] = [];
    const link = 'https://example.com/article';

    const { finalCaption, tweetText } = assembleTweet(superLongCaption, tags, link);
    const finalLen = computeTweetLength(finalCaption, [], link);

    expect(finalLen).toBeLessThanOrEqual(280);
    expect(finalCaption.endsWith('...')).toBe(true);
  });
});
