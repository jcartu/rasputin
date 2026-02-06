'use client';

import { SharedSessionViewer } from './SharedSessionViewer';

interface EmbedViewerProps {
  token: string;
}

export function EmbedViewer({ token }: EmbedViewerProps) {
  return (
    <div className="w-full h-full bg-background text-foreground">
      <SharedSessionViewer token={token} embedded={true} />
    </div>
  );
}

export default EmbedViewer;
