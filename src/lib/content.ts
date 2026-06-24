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

/** Interviews per page (home + each archive page). */
const PAGE_SIZE = 12;

export interface InterviewPage {
  /** Contiguous position: 0 = first page (newest), shown on the home page. */
  index: number;
  items: any[];
}

/**
 * Paginate interviews newest-first by a fixed count — not by date window.
 *
 * Sort order: dated interviews first, most recent date first; then undated
 * "previous interviews" in their curated `order`. The result is chunked into
 * pages of PAGE_SIZE so the home page (page 0) and each "Previous interviews"
 * page are always a tidy size, whether or not interviews are dated. Dates,
 * when present, only affect a card's label and sort position.
 */
export function paginateInterviews(items: any[]): InterviewPage[] {
  const sorted = [...items].sort((a, b) => {
    const ad = a.data.publishedAt ? new Date(a.data.publishedAt).getTime() : null;
    const bd = b.data.publishedAt ? new Date(b.data.publishedAt).getTime() : null;
    if (ad !== null && bd !== null) return bd - ad; // both dated: newest first
    if (ad !== null) return -1; // dated before undated
    if (bd !== null) return 1;
    return (a.data.order ?? 0) - (b.data.order ?? 0); // both undated: curated order
  });

  const pages: InterviewPage[] = [];
  for (let i = 0; i < sorted.length; i += PAGE_SIZE) {
    pages.push({ index: pages.length, items: sorted.slice(i, i + PAGE_SIZE) });
  }
  return pages;
}
