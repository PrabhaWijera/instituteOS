/**
 * Reverses legacy sanitize middleware that entity-encoded slashes in URLs.
 */
export function decodeStoredUrl(url: string): string {
  if (!url) return url;
  return url
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}
