import { RawArticleItem } from '../types';

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'msclkid',
  'ref',
  'source',
  'mc_cid',
  'mc_eid',
];

/**
 * Canonicalizes a URL by removing tracking params, hash fragments, and trailing slashes.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // Lowercase host
    url.hostname = url.hostname.toLowerCase();
    // Remove hash
    url.hash = '';

    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Convert back to string and strip trailing slash if pathname > 1
    let clean = url.toString();
    if (clean.endsWith('/') && url.pathname !== '/') {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Normalizes, filters, and deduplicates raw article items.
 */
export function normalizeArticles(
  items: RawArticleItem[],
  options: {
    maxAgeHours?: number;
    existingRecentUrls?: Set<string>;
    now?: Date;
  } = {}
): RawArticleItem[] {
  const maxAgeHours = options.maxAgeHours ?? 24;
  const now = options.now ?? new Date();
  const existingRecentUrls = options.existingRecentUrls ?? new Set<string>();

  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const cutoffTime = now.getTime() - maxAgeMs;

  const seenUrls = new Set<string>();
  const normalized: RawArticleItem[] = [];

  for (const item of items) {
    if (!item.title || !item.title.trim()) continue;
    if (!item.url || !item.url.trim()) continue;

    const canonicalUrl = canonicalizeUrl(item.url);
    if (!canonicalUrl) continue;

    // Check recent duplicate
    if (existingRecentUrls.has(canonicalUrl)) continue;

    // Check duplicate in current run
    if (seenUrls.has(canonicalUrl)) continue;

    // Age filter
    const itemTime = item.publishedAt.getTime();
    if (!isNaN(itemTime) && itemTime < cutoffTime) {
      continue;
    }

    seenUrls.add(canonicalUrl);
    normalized.push({
      ...item,
      title: item.title.trim(),
      url: canonicalUrl,
    });
  }

  return normalized;
}
