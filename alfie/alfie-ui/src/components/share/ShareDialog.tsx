"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Code,
  Copy,
  Globe,
  Link,
  Lock,
  Share2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useChatStore } from "@/lib/store";
import { shareHelpers, useShareStore } from "@/lib/shareStore";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "No expiration" },
  { value: "1d", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const getExpiryDate = (value: string): Date | undefined => {
  const now = new Date();
  if (value === "1d") {
    now.setDate(now.getDate() + 1);
    return now;
  }
  if (value === "7d") {
    now.setDate(now.getDate() + 7);
    return now;
  }
  if (value === "30d") {
    now.setDate(now.getDate() + 30);
    return now;
  }
  return undefined;
};

export function ShareDialog({ open, onOpenChange, sessionId }: ShareDialogProps) {
  const [isPublic, setIsPublic] = useState(true);
  const [expiresIn, setExpiresIn] = useState("never");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessions = useChatStore(state => state.sessions);
  const activeSessionId = useChatStore(state => state.activeSessionId);
  const createShare = useShareStore(state => state.createShare);

  const targetSessionId = sessionId || activeSessionId;
  const currentSession = useMemo(
    () => sessions.find(session => session.id === targetSessionId),
    [sessions, targetSessionId]
  );

  const embedCode = createdToken
    ? shareHelpers.buildEmbedCode(createdToken)
    : "";

  const handleCreate = () => {
    if (!currentSession) {
      setError("No active session to share.");
      return;
    }

    const url = createShare(
      currentSession.id,
      currentSession.name,
      currentSession.messages,
      {
        isPublic,
        expiresAt: getExpiryDate(expiresIn),
      }
    );

    try {
      const token = new URL(url).pathname.split("/").pop() || "";
      setCreatedToken(token);
    } catch {
      const token = url.split("/").pop() || "";
      setCreatedToken(token);
    }
    setCreatedUrl(url);
    setError(null);
  };

  const handleCopy = async (value: string, type: "link" | "embed") => {
    await navigator.clipboard.writeText(value);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  const handleReset = () => {
    setCreatedUrl(null);
    setCreatedToken(null);
    setCopiedLink(false);
    setCopiedEmbed(false);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share Conversation
            {currentSession && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {currentSession.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-500" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {isPublic ? "Public link" : "Private link"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPublic
                      ? "Anyone with the link can view"
                      : "Only people you send the link to"}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                aria-label="Toggle share privacy"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Expiration</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              <Select
                value={expiresIn}
                onValueChange={setExpiresIn}
                options={EXPIRY_OPTIONS}
                className="w-44"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleCreate}
              className="w-full"
              disabled={!currentSession}
            >
              <Link className="h-4 w-4 mr-2" />
              Create Share Link
            </Button>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {createdUrl && (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium mb-1.5 block">Share URL</span>
                <div className="flex gap-2">
                  <Input
                    value={createdUrl}
                    readOnly
                    className="font-mono text-sm"
                    aria-label="Share URL"
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(createdUrl, "link")}
                    aria-label="Copy share URL"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium mb-1.5 block">Embed Code</span>
                <div className="relative">
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto font-mono">
                    {embedCode}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(embedCode, "embed")}
                    aria-label="Copy embed code"
                  >
                    {copiedEmbed ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Code className="h-3.5 w-3.5" />
                  Use this iframe to embed the conversation.
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Create Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDialog;
