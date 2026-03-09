"use client";

import { useCallback, useMemo, useState } from "react";
import { AtSign, Check, Copy, Download, Mail, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { cn } from "@/lib/utils";

type EmailPreviewProps = {
  to?: string;
  from?: string;
  subject: string;
  body: string;
  date?: string;
};

export function EmailPreview({
  to,
  from,
  subject,
  body,
  date,
}: EmailPreviewProps) {
  const [copied, setCopied] = useState<"body" | "all" | null>(null);

  const normalizedDate = useMemo(() => {
    if (!date) return new Date().toLocaleString();
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleString();
  }, [date]);

  const headerLines = useMemo(() => {
    const dateValue = date ? normalizedDate : new Date().toLocaleString();
    return [
      `To: ${to || ""}`.trim(),
      `From: ${from || ""}`.trim(),
      `Subject: ${subject}`.trim(),
      `Date: ${dateValue}`.trim(),
    ].filter(line => line.length > 0);
  }, [to, from, subject, date, normalizedDate]);

  const copyAllText = useMemo(() => {
    return `${headerLines.join("\n")}\n\n${body}`.trim();
  }, [headerLines, body]);

  const emlContent = useMemo(() => {
    const emlHeaders = [
      ...headerLines,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=\"UTF-8\"",
      "Content-Transfer-Encoding: 7bit",
    ];
    return `${emlHeaders.join("\r\n")}\r\n\r\n${body}`;
  }, [headerLines, body]);

  const handleCopyBody = useCallback(async () => {
    await navigator.clipboard.writeText(body);
    setCopied("body");
    setTimeout(() => setCopied(null), 2000);
  }, [body]);

  const handleCopyAll = useCallback(async () => {
    await navigator.clipboard.writeText(copyAllText);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  }, [copyAllText]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([emlContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${subject || "draft"}.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [emlContent, subject]);

  return (
    <Card
      variant="default"
      className="rounded-xl border-border/60 bg-card/80"
    >
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              <span>AI Email Draft</span>
            </div>
            <CardTitle className="text-lg font-semibold leading-tight">
              {subject}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {normalizedDate}
          </Badge>
        </div>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AtSign className="h-4 w-4" />
            <span className="font-medium text-foreground">To:</span>
            <span className="truncate">{to || "Not specified"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="font-medium text-foreground">From:</span>
            <span className="truncate">{from || "You"}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-border/60 bg-background/80 p-4">
          <MarkdownRenderer
            content={body}
            enableEmailPreview={false}
            enableCopyButton={false}
            enableSlideView={false}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="uppercase tracking-wide">
            Draft
          </Badge>
          <span>{body.length.toLocaleString()} characters</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyBody}>
            {copied === "body" ? (
              <Check className="mr-2 h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy Body
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            {copied === "all" ? (
              <Check className="mr-2 h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy All
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            className={cn("shadow-sm")}
          >
            <Download className="mr-2 h-4 w-4" />
            Download .eml
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
