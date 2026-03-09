"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, MessageSquare } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useShareStore } from "@/lib/shareStore";
import { cn } from "@/lib/utils";

interface SharedSessionViewerProps {
  token: string;
  embedded?: boolean;
}

export function SharedSessionViewer({ token, embedded = false }: SharedSessionViewerProps) {
  const [hydrated, setHydrated] = useState(false);
  const share = useShareStore(state => state.getShare(token));

  useEffect(() => {
    const unsub = useShareStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useShareStore.persist.hasHydrated());
    return () => unsub();
  }, []);

  const title = useMemo(() => share?.title || "Shared Conversation", [share?.title]);
  const createdDate = useMemo(() => {
    if (!share?.createdAt) return "";
    return new Date(share.createdAt).toLocaleDateString();
  }, [share?.createdAt]);

  if (!hydrated) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "h-full" : "min-h-screen")}>
        <p className="text-sm text-muted-foreground">Loading shared conversation...</p>
      </div>
    );
  }

  if (!share) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "h-full" : "min-h-screen")}>
        <div className="text-center max-w-md p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-xl font-bold mt-4">Share link not found</h2>
          <p className="text-muted-foreground mt-2">
            This shared conversation doesn&apos;t exist or has expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", embedded ? "h-full" : "min-h-screen")}> 
      {!embedded && (
        <div className="border-b bg-primary/5 text-primary px-4 py-2 text-sm font-medium">
          This conversation was shared from ALFIE
        </div>
      )}

      {!embedded && (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">{title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {createdDate && <span>Shared on {createdDate}</span>}
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {share.messages.length} message{share.messages.length !== 1 ? "s" : ""}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {share.isPublic ? "Public" : "Private"}
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={cn("flex-1 overflow-auto", !embedded && "max-w-4xl mx-auto w-full")}> 
        <div className="p-4 space-y-4">
          {share.messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </main>
    </div>
  );
}

export default SharedSessionViewer;
