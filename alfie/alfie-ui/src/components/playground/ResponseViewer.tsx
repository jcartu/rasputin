'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  Check,
  Download,
  FileJson,
  FileText,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { usePlaygroundStore } from '@/lib/playground/store';
import { ApiResponse } from '@/lib/playground/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-500 bg-emerald-500/10';
  if (status >= 300 && status < 400) return 'text-blue-500 bg-blue-500/10';
  if (status >= 400 && status < 500) return 'text-amber-500 bg-amber-500/10';
  return 'text-red-500 bg-red-500/10';
}

function getStatusIcon(status: number) {
  if (status >= 200 && status < 300) return CheckCircle;
  if (status >= 400) return XCircle;
  return AlertCircle;
}

export function ResponseViewer() {
  const { currentResponse, isLoading, responseTab, setResponseTab } = usePlaygroundStore();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [format, setFormat] = useState<'pretty' | 'raw'>('pretty');

  const formattedBody = useMemo(() => {
    if (!currentResponse?.body) return '';
    if (format === 'raw') return currentResponse.body;

    try {
      const parsed = JSON.parse(currentResponse.body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return currentResponse.body;
    }
  }, [currentResponse?.body, format]);

  const isJson = useMemo(() => {
    if (!currentResponse?.body) return false;
    try {
      JSON.parse(currentResponse.body);
      return true;
    } catch {
      return false;
    }
  }, [currentResponse?.body]);

  const handleCopy = () => {
    if (currentResponse?.body) {
      navigator.clipboard.writeText(formattedBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (currentResponse?.body) {
      const blob = new Blob([formattedBody], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `response-${Date.now()}.${isJson ? 'json' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent"
        />
        <p className="mt-4 text-muted-foreground">Sending request...</p>
      </div>
    );
  }

  if (!currentResponse) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <FileJson className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No response yet</p>
          <p className="text-sm mt-2">Send a request to see the response here</p>
          <p className="text-xs mt-4 text-muted-foreground/60">Press ⌘+Enter to send</p>
        </motion.div>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(currentResponse.status);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={cn('font-mono font-bold gap-1.5', getStatusColor(currentResponse.status))}>
              <StatusIcon className="w-3.5 h-3.5" />
              {currentResponse.status} {currentResponse.statusText}
            </Badge>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {currentResponse.time}ms
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                {formatBytes(currentResponse.size)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isJson && (
              <div className="flex rounded-lg border border-border overflow-hidden mr-2">
                <button
                  type="button"
                  onClick={() => setFormat('pretty')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    format === 'pretty' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  Pretty
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('raw')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    format === 'raw' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  Raw
                </button>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={responseTab}
        onValueChange={(v) => setResponseTab(v as 'body' | 'headers' | 'cookies' | 'timeline')}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border px-4">
          <TabsList className="h-10 bg-transparent p-0 w-full justify-start gap-6">
            <TabsTrigger
              value="body"
              className="h-10 px-0 pb-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <FileJson className="w-4 h-4 mr-2" />
              Body
            </TabsTrigger>
            <TabsTrigger
              value="headers"
              className="h-10 px-0 pb-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <FileText className="w-4 h-4 mr-2" />
              Headers
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">
                {Object.keys(currentResponse.headers).length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="body" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">
              {isJson ? <JsonSyntaxHighlight content={formattedBody} /> : formattedBody}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {Object.entries(currentResponse.headers).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="font-mono text-sm font-medium text-primary min-w-[200px]">
                    {key}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground break-all">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JsonSyntaxHighlight({ content }: { content: string }) {
  const highlighted = content
    .replace(/"([^"]+)":/g, '<span class="text-cyan-500">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="text-amber-500">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="text-emerald-500">$1</span>')
    .replace(/: (true|false)/g, ': <span class="text-purple-500">$1</span>')
    .replace(/: (null)/g, ': <span class="text-red-500">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
