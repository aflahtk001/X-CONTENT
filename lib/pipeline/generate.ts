import { z } from 'zod';
import { generateGroqCompletion } from '../groq';
import { ClusteredStory } from './cluster';
import { PageAnalysisResult } from './analyze-page';
import { evaluateCandidatesWithLaya, PostCandidateItem } from '../laya';

const SinglePostSchema = z.object({
  title: z.string().min(3).max(200),
  caption: z.string().min(10).max(500),
  tags: z.array(z.string()).min(1).max(10),
});

const MultiPostSchema = z.object({
  candidates: z.array(SinglePostSchema).min(1).max(5),
});

export interface GeneratedPostContent {
  title: string;
  caption: string;
  tags: string[];
}

/**
 * Normalizes a hashtag string: ensures leading '#', strips invalid chars, dedupes.
 */
export function normalizeTag(tag: string): string {
  let clean = tag.trim().replace(/^#+/, '');
  clean = clean.replace(/[^a-zA-Z0-9_]/g, '');
  return clean.length > 0 ? `#${clean}` : '';
}

/**
 * Enforces strict limits on generated post fields.
 */
export function sanitizeGeneratedContent(
  raw: { title: string; caption: string; tags: string[] },
  brandHashtags: string[] = []
): GeneratedPostContent {
  // Title <= 80 chars
  let title = raw.title.trim().replace(/\s+/g, ' ');
  if (title.length > 80) {
    title = title.slice(0, 77).trim() + '...';
  }

  // Caption <= 220 chars
  let caption = raw.caption.trim().replace(/\s+/g, ' ');
  if (caption.length > 220) {
    const cut = caption.slice(0, 217);
    const lastSpace = cut.lastIndexOf(' ');
    caption = (lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trim() + '...';
  }

  // Normalize tags
  const tagSet = new Set<string>();
  const normalizedTags: string[] = [];

  for (const t of raw.tags) {
    const cleanTag = normalizeTag(t);
    const lower = cleanTag.toLowerCase();
    if (cleanTag && !tagSet.has(lower)) {
      tagSet.add(lower);
      normalizedTags.push(cleanTag);
    }
  }

  // Add brand hashtags if available and total <= 5
  for (const b of brandHashtags) {
    const cleanBrand = normalizeTag(b);
    const lower = cleanBrand.toLowerCase();
    if (cleanBrand && !tagSet.has(lower) && normalizedTags.length < 5) {
      tagSet.add(lower);
      normalizedTags.push(cleanBrand);
    }
  }

  // Ensure 3-5 tags
  let finalTags = normalizedTags.slice(0, 5);
  if (finalTags.length === 0) {
    finalTags = ['#TechNews', '#Innovation', '#Tech'];
  }

  return {
    title,
    caption,
    tags: finalTags,
  };
}

/**
 * Parses JSON from model output, handling potential markdown fences.
 */
export function parseModelJson(rawOutput: string): any {
  let cleaned = rawOutput.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt regex extraction of first JSON object { ... }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Unable to parse valid JSON from model response: ${rawOutput.slice(0, 100)}...`);
  }
}

/**
 * Extracts candidate posts from parsed JSON (handles both single post and multi-candidate format).
 */
export function extractCandidatePosts(parsed: any): PostCandidateItem[] {
  const multiRes = MultiPostSchema.safeParse(parsed);
  if (multiRes.success && multiRes.data.candidates.length > 0) {
    return multiRes.data.candidates;
  }

  const singleRes = SinglePostSchema.safeParse(parsed);
  if (singleRes.success) {
    return [singleRes.data];
  }

  if (Array.isArray(parsed) && parsed.length > 0) {
    const valid = parsed
      .map((item) => SinglePostSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => (r as any).data);
    if (valid.length > 0) return valid;
  }

  throw new Error('Could not parse valid candidate posts from response');
}

/**
 * Generates Twitter post content using Groq LLM and ranks with Laya decision model.
 */
export async function generateSocialPost(
  cluster: ClusteredStory,
  pageAnalysis: PageAnalysisResult,
  options: {
    model?: string;
    tone?: string;
    brandHashtags?: string[];
    customInstruction?: string;
    temperature?: number;
    useLayaJudge?: boolean;
    layaApiUrl?: string;
  } = {}
): Promise<GeneratedPostContent> {
  const tone = options.tone || 'magnetic, viral tech copywriting, high-engagement hooks, curiosity gaps, zero fluff';
  const brandHashtags = options.brandHashtags || [];
  const useLayaJudge = options.useLayaJudge ?? true;

  const otherSources = Array.from(
    new Set(cluster.articles.map((a) => a.source).filter((s) => s !== 'Hacker News'))
  ).join(', ');

  const systemPrompt = `You are a world-class viral tech social media editor on Twitter/X known for writing scroll-stopping, high-CTR tweet hooks. 
You write with precision, high curiosity gaps, and sharp insights that compel readers to stop scrolling and click the link to read the full story.
Tone: ${tone}.
Rules:
1. Generate 3 distinct high-engagement copywriting variations:
   - Variation 1 (Curiosity Gap): Opens an intriguing loop in sentence 1; delivers tension in sentence 2.
   - Variation 2 (Contrarian / Industry Shift): Highlights a major disruptive pivot, unexpected finding, or bold statement.
   - Variation 3 (High-Impact Insight): Sharp, fast, punchy breakthrough takeaway.
2. Max 220 characters for each caption. No hashtags and no URLs in the caption (they are added separately). At most 1 high-impact emoji.
3. Be completely accurate and factual based ONLY on the provided text. Never hallucinate or invent numbers/facts.
4. Output raw JSON only.`;

  let userPrompt = `Craft 3 viral Twitter/X post candidate variations for this trending tech story:

Headline: ${cluster.headline}
Covered By: ${otherSources || 'Tech Industry'}
Description: ${pageAnalysis.description || 'N/A'}
Article Excerpt: ${pageAnalysis.bodyText.slice(0, 3000)}

Return ONLY a valid JSON object matching this schema:
{
  "candidates": [
    {
      "title": "Punchy headline for variant 1 (max 80 chars)",
      "caption": "Irresistible curiosity hook. The tension that forces them to read.",
      "tags": ["#Tag1", "#Tag2", "#Tag3"]
    },
    {
      "title": "Disruptive headline for variant 2 (max 80 chars)",
      "caption": "Bold shift or unexpected finding that changes how people think.",
      "tags": ["#Tag1", "#Tag2", "#Tag3"]
    },
    {
      "title": "High-impact headline for variant 3 (max 80 chars)",
      "caption": "Sharp breakthrough takeaway delivering immediate value.",
      "tags": ["#Tag1", "#Tag2", "#Tag3"]
    }
  ]
}`;

  if (options.customInstruction) {
    userPrompt += `\nAdditional user instruction: ${options.customInstruction}`;
  }

  let candidates: PostCandidateItem[] = [];

  try {
    const rawResponse = await generateGroqCompletion({
      model: options.model,
      systemPrompt,
      userPrompt,
      temperature: options.temperature ?? 0.7,
      maxTokens: 2500,
    });

    const parsed = parseModelJson(rawResponse);
    candidates = extractCandidatePosts(parsed);
  } catch (err: any) {
    // Retry once with simplified single post fallback
    const retryPrompt = `${userPrompt}\n\nIMPORTANT: Your previous output was invalid. Return ONLY a valid JSON matching {"candidates": [{"title": "...", "caption": "...", "tags": ["#Tech"]}]}`;
    const retryRaw = await generateGroqCompletion({
      model: options.model,
      systemPrompt,
      userPrompt: retryPrompt,
      temperature: 0.4,
      maxTokens: 2500,
    });

    const parsedRetry = parseModelJson(retryRaw);
    candidates = extractCandidatePosts(parsedRetry);
  }

  let selectedCandidate = candidates[0];

  // If Laya decision model is enabled and we have multiple candidates, rank them!
  if (useLayaJudge && candidates.length > 1) {
    const storySummary = `${cluster.headline}\n${pageAnalysis.description || ''}`;
    const layaResult = await evaluateCandidatesWithLaya(storySummary, candidates, options.layaApiUrl);
    if (layaResult && layaResult.bestCandidate) {
      selectedCandidate = layaResult.bestCandidate;
    }
  }

  return sanitizeGeneratedContent(selectedCandidate, brandHashtags);
}

