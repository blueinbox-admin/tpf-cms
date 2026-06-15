import { marked } from "marked";

/**
 * Render rich-text / markdown (as authored in the CMS) to HTML.
 * Existing plain-text answers with blank-line paragraph breaks render
 * unchanged, so old content stays compatible.
 */
export function renderRichText(input: string | undefined | null): string {
  if (!input) return "";
  const html = marked.parse(input, { async: false }) as string;
  // Open external links in a new tab.
  return html.replace(
    /<a\s+href="(https?:\/\/[^"]*)"/g,
    '<a target="_blank" rel="noopener noreferrer" href="$1"'
  );
}

/**
 * Turn any Vimeo URL (or bare ID) into a player embed URL.
 * Handles public, unlisted, and private videos:
 *   vimeo.com/123                -> player.vimeo.com/video/123
 *   vimeo.com/123/abcdef         -> player.vimeo.com/video/123?h=abcdef
 *   vimeo.com/123?h=abcdef       -> player.vimeo.com/video/123?h=abcdef
 *   player.vimeo.com/video/123   -> unchanged (normalized)
 * Returns null if no video id can be found.
 */
export function vimeoEmbedUrl(input: string | undefined | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Bare numeric id.
  if (/^\d+$/.test(raw)) return `https://player.vimeo.com/video/${raw}`;

  let id: string | null = null;
  let hash: string | null = null;

  // /video/<id> (player URLs) or /<id> (share URLs), optional /<hash>.
  const pathMatch = raw.match(/(?:video\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/);
  if (pathMatch) {
    id = pathMatch[1];
    if (pathMatch[2]) hash = pathMatch[2];
  }

  // ?h=<hash> query form.
  const hMatch = raw.match(/[?&]h=([0-9a-zA-Z]+)/);
  if (hMatch) hash = hMatch[1];

  if (!id) return null;
  return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface InterviewWindow {
  /** 0 = most recent 12 months, 1 = the 12 months before that, etc. */
  index: number;
  /** Inclusive start (older) bound, exclusive of the previous window. */
  label: string;
  items: any[];
}

/**
 * Group interviews into rolling 12-month windows counting back from `now`,
 * newest first. Empty windows (year gaps) are skipped so paging always lands
 * on content. Expects items already sorted newest-first by publishedAt.
 */
export function groupByYearWindow(items: any[], now: Date): InterviewWindow[] {
  const buckets = new Map<number, any[]>();

  for (const item of items) {
    const published = new Date(item.data.publishedAt);
    const daysAgo = Math.floor((now.getTime() - published.getTime()) / MS_PER_DAY);
    // Future-dated items fall into the most recent window.
    const idx = Math.max(0, Math.floor(daysAgo / 365));
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx)!.push(item);
  }

  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const items = buckets.get(index)!;
      const years = items.map((i) => new Date(i.data.publishedAt).getFullYear());
      const min = Math.min(...years);
      const max = Math.max(...years);
      const label = min === max ? `${min}` : `${min}–${max}`;
      return { index, label, items };
    });
}
