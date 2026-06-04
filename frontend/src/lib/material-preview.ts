/** Shared URL helpers for PDF / video material preview */

/** Fix URLs corrupted by legacy API sanitizer (&#x2F; instead of /) */
export function decodeMaterialUrl(url: string): string {
  if (!url) return '';
  return url
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&amp;/g, '&')
    .trim();
}

export function normalizeMaterialUrl(url: string): string {
  if (!url) return '';
  let trimmed = decodeMaterialUrl(url).trim();

  // Fix double-prefixed https from bad saves
  trimmed = trimmed.replace(/^https:\/\/https:\/\//i, 'https://');
  trimmed = trimmed.replace(/^https:\/\/https:/i, 'https://');

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const normalized = normalizeMaterialUrl(url);
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
      const liveIdx = parts.indexOf('live');
      if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    }
  } catch {
    /* invalid URL */
  }
  const decoded = decodeMaterialUrl(url);
  const fallback = decoded.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return fallback?.[1] ?? null;
}

export type VideoEmbed =
  | { type: 'youtube'; src: string; ytId: string }
  | { type: 'iframe'; src: string }
  | { type: 'video'; src: string };

export function getVideoEmbed(url: string, origin?: string): VideoEmbed {
  const normalized = normalizeMaterialUrl(url);
  const ytId = extractYouTubeId(normalized);
  if (ytId) {
    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
    return {
      type: 'youtube',
      ytId,
      src: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1${originParam}`,
    };
  }
  const vimeoMatch = normalized.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }
  const driveMatch = normalized.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return { type: 'iframe', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  }
  return { type: 'video', src: normalized };
}

/** Insert Cloudinary flags so PDF opens inline in browser instead of forcing download */
export function getCloudinaryInlinePdfUrl(url: string): string {
  const normalized = normalizeMaterialUrl(url);
  if (!normalized.includes('res.cloudinary.com')) return normalized;
  if (normalized.includes('fl_attachment:false') || normalized.includes('fl_inline')) {
    return normalized;
  }
  return normalized.replace('/upload/', '/upload/fl_attachment:false/');
}

export function getPdfPreviewUrls(url: string): { direct: string; viewer: string } {
  const direct = getCloudinaryInlinePdfUrl(url);
  const viewer = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(direct)}`;
  return { direct, viewer };
}

/** @deprecated use getPdfPreviewUrls */
export function getPdfPreviewSrc(url: string): string {
  return getPdfPreviewUrls(url).viewer;
}

export function isPdfMaterial(type: string): boolean {
  return type === 'PDF';
}

export function isVideoMaterial(type: string): boolean {
  return type === 'VIDEO_LINK';
}
