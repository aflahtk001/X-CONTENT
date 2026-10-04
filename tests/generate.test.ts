import { describe, it, expect } from 'vitest';
import { parseModelJson, sanitizeGeneratedContent, normalizeTag } from '../lib/pipeline/generate';

describe('Groq Output Parsing & Sanitization', () => {
  it('parses valid JSON directly', () => {
    const jsonStr = JSON.stringify({
      title: 'Valid headline',
      caption: 'Valid caption body',
      tags: ['#AI', '#Tech'],
    });

    const parsed = parseModelJson(jsonStr);
    expect(parsed.title).toBe('Valid headline');
  });

  it('extracts JSON when wrapped in markdown codeblocks or prose', () => {
    const raw = 'Here is the generated tweet content:\n```json\n{"title": "AI Breakthrough", "caption": "Details inside", "tags": ["#AI"]}\n```\nHope you like it!';
    const parsed = parseModelJson(raw);
    expect(parsed.title).toBe('AI Breakthrough');
  });

  it('normalizes tags and enforces title and caption character limits', () => {
    const raw = {
      title: 'A'.repeat(150), // should be trimmed to <= 80
      caption: 'B'.repeat(300), // should be trimmed to <= 220
      tags: ['ai', '##tech!!', '#Innovation', 'ai'], // should be normalized and deduped
    };

    const sanitized = sanitizeGeneratedContent(raw, ['#BrandTag']);
    expect(sanitized.title.length).toBeLessThanOrEqual(80);
    expect(sanitized.caption.length).toBeLessThanOrEqual(220);
    expect(sanitized.tags).toContain('#ai');
    expect(sanitized.tags).toContain('#tech');
    expect(sanitized.tags).toContain('#BrandTag');
  });
});
