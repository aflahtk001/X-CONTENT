import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { safeFetch } from '../safe-fetch';

export interface PageAnalysisResult {
  imageUrl: string | null;
  allFoundImages: string[];
  description: string | null;
  bodyText: string;
}

/**
 * Validates if an image URL is accessible and returns an image content type.
 */
export async function validateImageUrl(imageUrl: string): Promise<boolean> {
  try {
    const res = await safeFetch(imageUrl, {
      method: 'HEAD',
      timeoutMs: 8000,
      maxRetries: 1,
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    return contentType.toLowerCase().startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * Extracts clean article body text using Mozilla Readability + JSDOM.
 */
export function extractBodyText(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article && article.textContent) {
      const clean = article.textContent.replace(/\s+/g, ' ').trim();
      return clean.slice(0, 3000);
    }
  } catch {
    // Fallback using cheerio
  }

  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, aside, form').remove();
  const text = $('article').text() || $('main').text() || $('body').text();
  return text.replace(/\s+/g, ' ').trim().slice(0, 3000);
}

/**
 * Extracts candidate image URLs from HTML in priority order.
 */
export function extractCandidateImages(html: string, baseUrl: string, rssFallbackImage?: string | null): string[] {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  const addCandidate = (raw?: string | null) => {
    if (!raw) return;
    try {
      const absolute = new URL(raw, baseUrl).toString();
      if (!candidates.includes(absolute) && !absolute.includes('.svg') && !absolute.includes('avatar') && !absolute.includes('logo')) {
        candidates.push(absolute);
      }
    } catch {}
  };

  // 1. og:image / og:image:secure_url
  addCandidate($('meta[property="og:image"]').attr('content'));
  addCandidate($('meta[property="og:image:secure_url"]').attr('content'));
  addCandidate($('meta[name="og:image"]').attr('content'));

  // 2. twitter:image / twitter:image:src
  addCandidate($('meta[name="twitter:image"]').attr('content'));
  addCandidate($('meta[name="twitter:image:src"]').attr('content'));
  addCandidate($('meta[property="twitter:image"]').attr('content'));

  // 3. link[rel="image_src"]
  addCandidate($('link[rel="image_src"]').attr('href'));

  // 4. RSS media fallback
  if (rssFallbackImage) {
    addCandidate(rssFallbackImage);
  }

  // 5. Large <img> inside <article> or <main>
  $('article img, main img, .post-content img, .article-content img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
    const width = parseInt($(el).attr('width') || '0', 10);
    const height = parseInt($(el).attr('height') || '0', 10);

    // Skip tiny images/tracking pixels
    if (width > 0 && width < 200) return;
    if (height > 0 && height < 200) return;

    if (src) {
      // If srcset, pick first url
      const firstSrc = src.split(',')[0].trim().split(' ')[0];
      addCandidate(firstSrc);
    }
  });

  return candidates;
}

/**
 * Analyzes an article page to extract description, best image, and clean body text.
 */
export async function analyzeArticlePage(
  url: string,
  rssSummaryFallback?: string | null,
  rssImageFallback?: string | null
): Promise<PageAnalysisResult> {
  try {
    const response = await safeFetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Description extraction
    let description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      rssSummaryFallback ||
      null;

    if (description) {
      description = description.replace(/\s+/g, ' ').trim();
    }

    // Body text extraction
    const bodyText = extractBodyText(html, url);

    // Candidate images extraction
    const candidateImages = extractCandidateImages(html, url, rssImageFallback);

    // Find first valid image
    let bestImage: string | null = null;
    for (const candidate of candidateImages) {
      const isValid = await validateImageUrl(candidate);
      if (isValid) {
        bestImage = candidate;
        break;
      }
    }

    return {
      imageUrl: bestImage || rssImageFallback || null,
      allFoundImages: candidateImages,
      description: description || rssSummaryFallback || null,
      bodyText: bodyText || rssSummaryFallback || '',
    };
  } catch {
    // If page fetch/scrape fails, fallback cleanly to RSS metadata
    return {
      imageUrl: rssImageFallback || null,
      allFoundImages: rssImageFallback ? [rssImageFallback] : [],
      description: rssSummaryFallback || null,
      bodyText: rssSummaryFallback || '',
    };
  }
}
