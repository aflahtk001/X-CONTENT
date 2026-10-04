import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { RawArticleItem, Source } from '../types';
import { safeFetch } from '../safe-fetch';

const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

/**
 * Strips HTML tags and trims summary to 500 chars max.
 */
export function cleanSummary(htmlOrText?: string | null): string | null {
  if (!htmlOrText) return null;
  const cleaned = htmlOrText
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > 500 ? cleaned.slice(0, 497) + '...' : cleaned;
}

/**
 * Ingests articles from an RSS feed.
 */
export async function ingestRss(source: Source): Promise<RawArticleItem[]> {
  const response = await safeFetch(source.url);
  const xmlText = await response.text();
  const feed = await rssParser.parseString(xmlText);

  const items: RawArticleItem[] = [];
  const entries = (feed.items || []).slice(0, 30);

  for (const entry of entries) {
    if (!entry.title || !entry.link) continue;

    let mediaImage: string | null = null;
    const mediaContent = (entry as any).mediaContent;
    const mediaThumbnail = (entry as any).mediaThumbnail;
    const enclosure = (entry as any).enclosure;

    if (mediaContent && Array.isArray(mediaContent) && mediaContent[0]?.$?.url) {
      mediaImage = mediaContent[0].$.url;
    } else if (mediaThumbnail && Array.isArray(mediaThumbnail) && mediaThumbnail[0]?.$?.url) {
      mediaImage = mediaThumbnail[0].$.url;
    } else if (enclosure?.url && enclosure.type?.startsWith('image/')) {
      mediaImage = enclosure.url;
    }

    const pubDate = entry.pubDate || entry.isoDate || (entry as any).published;
    const publishedAt = pubDate ? new Date(pubDate) : new Date();

    items.push({
      source: source.name,
      title: entry.title.trim(),
      url: entry.link.trim(),
      summary: cleanSummary(entry.contentSnippet || entry.summary || (entry as any).contentEncoded || entry.content),
      publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
      mediaImage,
    });
  }

  return items;
}

/**
 * Helper to extract value based on selector supporting '@attr' syntax.
 */
function extractValue($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>, selectorSpec?: string): string | null {
  if (!selectorSpec) return null;

  const [selector, attr] = selectorSpec.split('@');
  const target = selector ? element.find(selector) : element;

  if (attr) {
    const val = target.attr(attr);
    return val ? val.trim() : null;
  }
  return target.text().trim() || null;
}

/**
 * Ingests articles from an HTML page using CSS selectors.
 */
export async function ingestHtml(source: Source): Promise<RawArticleItem[]> {
  if (!source.selectors || !source.selectors.item) {
    throw new Error(`HTML source ${source.name} is missing 'item' selector.`);
  }

  const response = await safeFetch(source.url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const items: RawArticleItem[] = [];
  const itemElements = $(source.selectors.item).slice(0, 30);

  itemElements.each((_, el) => {
    const $el = $(el);
    const title = extractValue($, $el, source.selectors?.title || 'a');
    let link = extractValue($, $el, source.selectors?.link || 'a@href');
    const summary = extractValue($, $el, source.selectors?.summary);
    const published = extractValue($, $el, source.selectors?.published);

    if (!title || !link) return;

    // Resolve relative URL
    try {
      link = new URL(link, source.url).toString();
    } catch {
      return;
    }

    let publishedAt = new Date();
    if (published) {
      const parsed = new Date(published);
      if (!isNaN(parsed.getTime())) {
        publishedAt = parsed;
      }
    }

    items.push({
      source: source.name,
      title: title.trim(),
      url: link,
      summary: cleanSummary(summary),
      publishedAt,
    });
  });

  return items;
}

/**
 * Fetches Hacker News frontpage trending items.
 */
export async function ingestHackerNews(): Promise<RawArticleItem[]> {
  const url = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40';
  const response = await safeFetch(url);
  const data = await response.json();

  const items: RawArticleItem[] = [];
  for (const hit of data.hits || []) {
    if (!hit.title || !hit.url) continue;

    items.push({
      source: 'Hacker News',
      title: hit.title.trim(),
      url: hit.url.trim(),
      summary: null,
      publishedAt: hit.created_at ? new Date(hit.created_at) : new Date(),
      points: hit.points || 0,
    });
  }

  return items;
}

/**
 * Auto-discovery helper: finds RSS/Atom feeds from a website URL.
 */
export async function discoverFeed(siteUrl: string): Promise<{ feedUrl: string; type: 'rss' | 'html'; title?: string } | null> {
  try {
    const response = await safeFetch(siteUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    // 1. Look for <link rel="alternate" type="application/rss+xml" or atom+xml>
    const rssLink = $('link[type="application/rss+xml"]').attr('href');
    if (rssLink) {
      return { feedUrl: new URL(rssLink, siteUrl).toString(), type: 'rss', title: $('title').text() };
    }

    const atomLink = $('link[type="application/atom+xml"]').attr('href');
    if (atomLink) {
      return { feedUrl: new URL(atomLink, siteUrl).toString(), type: 'rss', title: $('title').text() };
    }

    // 2. Try common feed paths
    const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/index.xml'];
    for (const path of commonPaths) {
      try {
        const candidate = new URL(path, siteUrl).toString();
        const candidateRes = await safeFetch(candidate, { timeoutMs: 5000, maxRetries: 0 });
        if (candidateRes.ok) {
          const text = await candidateRes.text();
          if (text.includes('<rss') || text.includes('<feed') || text.includes('<?xml')) {
            return { feedUrl: candidate, type: 'rss', title: $('title').text() };
          }
        }
      } catch {
        // Continue checking next candidate
      }
    }
  } catch (err) {
    // Discovery failed, fallback to html or user input
  }

  return null;
}
