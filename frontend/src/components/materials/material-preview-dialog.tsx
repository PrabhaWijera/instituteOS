'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, FileText, Play } from 'lucide-react';
import {
  getPdfPreviewUrls,
  getVideoEmbed,
  isPdfMaterial,
  normalizeMaterialUrl,
} from '@/lib/material-preview';

export interface MaterialPreviewItem {
  id: string;
  title: string;
  type: string;
  url: string;
}

function PdfPreviewBody({ url, title }: { url: string; title: string }) {
  const { direct, viewer } = getPdfPreviewUrls(url);
  const h = 'min(70vh, 640px)';

  return (
    <object
      data={direct}
      type="application/pdf"
      title={title}
      style={{ width: '100%', height: h, display: 'block', background: '#fff' }}
    >
      <iframe
        src={viewer}
        title={title}
        style={{ width: '100%', height: h, border: 'none', display: 'block', background: '#fff' }}
      />
      <p className="p-4 text-center text-sm text-muted-foreground">
        PDF preview not supported in this browser.{' '}
        <a href={direct} target="_blank" rel="noopener noreferrer" className="text-primary underline">
          Open PDF in new tab
        </a>
      </p>
    </object>
  );
}

function VideoEmbedBody({ url, title }: { url: string; title: string }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const embed = getVideoEmbed(url, origin);
  const h = 'min(70vh, 640px)';

  if (embed.type === 'youtube') {
    return (
      <iframe
        src={embed.src}
        title={title}
        style={{ width: '100%', height: h, border: 'none', display: 'block', background: '#000' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  if (embed.type === 'iframe') {
    return (
      <iframe
        src={embed.src}
        title={title}
        style={{ width: '100%', height: h, border: 'none', display: 'block' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={embed.src}
      controls
      playsInline
      style={{ width: '100%', height: h, display: 'block', background: '#000' }}
    />
  );
}

interface MaterialPreviewDialogProps {
  material: MaterialPreviewItem | null;
  onClose: () => void;
}

export function MaterialPreviewDialog({ material, onClose }: MaterialPreviewDialogProps) {
  if (!material) return null;

  const isPdf = isPdfMaterial(material.type);
  const openUrl = isPdf ? getPdfPreviewUrls(material.url).direct : normalizeMaterialUrl(material.url);

  return (
    <Dialog open={!!material} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden"
        style={{ maxHeight: '95vh' }}
      >
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold min-w-0">
              {isPdf ? <FileText className="h-4 w-4 shrink-0" /> : <Play className="h-4 w-4 shrink-0" />}
              <span className="truncate">{material.title}</span>
            </DialogTitle>
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary whitespace-nowrap shrink-0"
            >
              <ExternalLink className="h-3 w-3" /> Open in new tab
            </a>
          </div>
        </DialogHeader>
        <div className="overflow-auto bg-muted/30">
          {isPdf ? (
            <PdfPreviewBody key={material.id} url={material.url} title={material.title} />
          ) : (
            <VideoEmbedBody key={material.id} url={material.url} title={material.title} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
