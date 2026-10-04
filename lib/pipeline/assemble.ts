export const X_URL_LENGTH = 23;

/**
 * Computes tweet length under Twitter/X rules (any URL is 23 characters).
 */
export function computeTweetLength(caption: string, tags: string[], link?: string): number {
  const cleanCaption = caption.trim();
  const tagsStr = tags.filter(Boolean).join(' ').trim();
  const hasLink = Boolean(link && link.trim());

  let len = cleanCaption.length;

  if (tagsStr.length > 0) {
    len += 2 + tagsStr.length; // "\n\n" + tags
  }

  if (hasLink) {
    len += 1 + X_URL_LENGTH; // "\n" + 23 chars for url
  }

  return len;
}

/**
 * Assembles final tweet text with strict adherence to the <= 280 character limit.
 * If over 280, it drops trailing hashtags one by one, then shortens caption if needed.
 */
export function assembleTweet(caption: string, tags: string[], link: string): { tweetText: string; finalTags: string[]; finalCaption: string } {
  let activeTags = [...tags.filter(Boolean)];
  let activeCaption = caption.trim();
  const cleanLink = link.trim();

  // 1. Drop trailing hashtags until within 280 chars or 0 tags left
  while (activeTags.length > 0 && computeTweetLength(activeCaption, activeTags, cleanLink) > 280) {
    activeTags.pop();
  }

  // 2. If still over 280, shorten caption
  if (computeTweetLength(activeCaption, activeTags, cleanLink) > 280) {
    const tagsStr = activeTags.join(' ').trim();
    const overhead = (tagsStr ? 2 + tagsStr.length : 0) + (cleanLink ? 1 + X_URL_LENGTH : 0);
    const maxCaptionLen = Math.max(20, 280 - overhead - 3); // 3 for "..."

    if (activeCaption.length > maxCaptionLen) {
      const cut = activeCaption.slice(0, maxCaptionLen);
      const lastSpace = cut.lastIndexOf(' ');
      activeCaption = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim() + '...';
    }
  }

  const tagsFormatted = activeTags.join(' ').trim();
  const parts: string[] = [activeCaption];

  if (tagsFormatted) {
    parts.push(`\n\n${tagsFormatted}`);
  }

  if (cleanLink) {
    parts.push(`\n${cleanLink}`);
  }

  const tweetText = parts.join('');

  return {
    tweetText,
    finalTags: activeTags,
    finalCaption: activeCaption,
  };
}
