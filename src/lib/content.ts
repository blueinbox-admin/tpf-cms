import { marked } from "marked";

/**
 * Render rich-text / markdown (as authored in the CMS) to HTML.
 * Existing plain-text answers with blank-line paragraph breaks render
 * unchanged, so old content stays compatible.
 */
export function renderRichText(input: string | undefined | null): string {
  if (!input) return "";
  const html = marked.parse(input, { async: false }) as string;

  // Normalize links: prepend https:// to bare external URLs (so a CMS editor
  // can type "www.google.com" and it still works), and open external links
  // in a new tab. Internal/anchor/mailto/tel links are left untouched.
  return html.replace(/<a href="([^"]*)"([^>]*)>/g, (match, href, rest) => {
    if (/^(\/|#|mailto:|tel:)/i.test(href)) return match;

    let url = href;
    if (!/^https?:\/\//i.test(href)) url = `https://${href}`;

    return `<a target="_blank" rel="noopener noreferrer" href="${url}"${rest}>`;
  });
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

/** Undated archive interviews are paged in groups of this size. */
const ARCHIVE_PAGE_SIZE = 12;

export interface InterviewWindow {
  /** Contiguous position: 0 = first (most recent) window, shown on the home page. */
  index: number;
  /** e.g. "2025" or "2024–2025"; empty for the undated archive. */
  label: string;
  items: any[];
}

/**
 * Build the ordered list of windows for the archive.
 *
 * Dated interviews are grouped into rolling 12-month windows counting back from
 * `now`, newest first (empty year-gaps skipped). Undated "previous interviews"
 * follow, ordered by their `order` field and chunked into fixed-size pages so
 * the archive never becomes one giant list. Window indexes are contiguous so
 * the /archive/[page] navigation chains cleanly.
 */
export function groupByYearWindow(items: any[], now: Date): InterviewWindow[] {
  const dated = items.filter((i) => i.data.publishedAt);
  const undated = items.filter((i) => !i.data.publishedAt);

  // --- Dated: rolling 12-month windows, newest first. ---
  const buckets = new Map<number, any[]>();
  for (const item of dated) {
    const published = new Date(item.data.publishedAt);
    const daysAgo = Math.floor((now.getTime() - published.getTime()) / MS_PER_DAY);
    const idx = Math.max(0, Math.floor(daysAgo / 365)); // future-dated -> most recent
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx)!.push(item);
  }

  const windows: InterviewWindow[] = [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((key) => {
      const group = buckets.get(key)!;
      const years = group.map((i) => new Date(i.data.publishedAt).getFullYear());
      const min = Math.min(...years);
      const max = Math.max(...years);
      return { index: 0, label: min === max ? `${min}` : `${min}–${max}`, items: group };
    });

  // --- Undated: ordered by `order`, chunked into archive pages. ---
  undated.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  for (let i = 0; i < undated.length; i += ARCHIVE_PAGE_SIZE) {
    windows.push({ index: 0, label: "", items: undated.slice(i, i + ARCHIVE_PAGE_SIZE) });
  }

  // Reassign contiguous indexes for clean paging.
  return windows.map((w, i) => ({ ...w, index: i }));
}
