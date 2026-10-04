import { describe, it, expect } from 'vitest';
import { extractCandidateImages, extractBodyText } from '../lib/pipeline/analyze-page';

describe('Page Analysis & Image Extraction', () => {
  it('extracts og:image with highest priority', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:image" content="https://example.com/og-primary.jpg" />
          <meta name="twitter:image" content="https://example.com/twitter-secondary.jpg" />
        </head>
        <body>
          <article>
            <p>Body paragraph</p>
          </article>
        </body>
      </html>
    `;

    const images = extractCandidateImages(html, 'https://example.com/article');
    expect(images[0]).toBe('https://example.com/og-primary.jpg');
  });

  it('falls back to twitter:image when og:image is missing', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="twitter:image" content="https://example.com/twitter-img.jpg" />
        </head>
        <body>
          <article>
            <p>Article content</p>
          </article>
        </body>
      </html>
    `;

    const images = extractCandidateImages(html, 'https://example.com/article');
    expect(images[0]).toBe('https://example.com/twitter-img.jpg');
  });

  it('extracts clean body text without HTML script or style tags', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Article</title></head>
        <body>
          <style>body { color: red; }</style>
          <article>
            <h1>Tech Revolution</h1>
            <p>Engineers have announced a major breakthrough in quantum computing today.</p>
          </article>
          <script>console.log("ad code")</script>
        </body>
      </html>
    `;

    const body = extractBodyText(html, 'https://example.com');
    expect(body).toContain('quantum computing');
    expect(body).not.toContain('console.log');
    expect(body).not.toContain('color: red');
  });
});
