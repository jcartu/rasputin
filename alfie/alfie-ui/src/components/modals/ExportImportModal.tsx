'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Upload,
  FileJson,
  FileText,
  FileType,
  Lock,
  Unlock,
  Link,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { exportApi, type ExportOptions } from '@/lib/api';
import { useChatStore, type Session } from '@/lib/store';

interface ExportImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'export' | 'import';
  preselectedSessionIds?: string[];
}

type ExportFormat = 'json' | 'markdown' | 'pdf';

const FORMAT_INFO: Record<ExportFormat, { icon: typeof FileJson; label: string; description: string; color: string }> = {
  json: {
    icon: FileJson,
    label: 'JSON',
    description: 'Full data with metadata, re-importable',
    color: 'text-amber-500',
  },
  markdown: {
    icon: FileText,
    label: 'Markdown',
    description: 'Human-readable, great for sharing',
    color: 'text-blue-500',
  },
  pdf: {
    icon: FileType,
    label: 'PDF',
    description: 'Printable document format',
    color: 'text-red-500',
  },
};

export function ExportImportModal({
  open,
  onOpenChange,
  initialTab = 'export',
  preselectedSessionIds = [],
}: ExportImportModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activeTab === 'export' ? (
              <>
                <Download className="w-5 h-5 text-primary" />
                Export Sessions
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-primary" />
                Import Sessions
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'export' | 'import')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="flex-1 overflow-auto mt-4">
            <ExportPanel
              preselectedSessionIds={preselectedSessionIds}
              onSuccess={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="import" className="flex-1 overflow-auto mt-4">
            <ImportPanel onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ExportPanel({
  preselectedSessionIds,
  onSuccess,
}: {
  preselectedSessionIds: string[];
  onSuccess: () => void;
}) {
  const sessions = useChatStore((state) => state.sessions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselectedSessionIds));
  const [format, setFormat] = useState<ExportFormat>('json');
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [includeThinking, setIncludeThinking] = useState(false);
  const [includeToolCalls, setIncludeToolCalls] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSession = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(sessions.map((s) => s.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one session');
      return;
    }

    if (encrypt && !password) {
      setError('Password required for encryption');
      return;
    }

    if (format === 'pdf' && selectedIds.size > 1) {
      setError('PDF format only supports single session export');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const options: ExportOptions = {
        sessionIds: Array.from(selectedIds),
        format,
        includeThinking,
        includeToolCalls,
        encrypt,
        password: encrypt ? password : undefined,
      };

      const blob = await exportApi.exportSessions(options);
      
      const ext = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'pdf';
      const encryptedSuffix = encrypt ? '.encrypted' : '';
      const filename = selectedIds.size === 1
        ? `session-export.${ext}${encryptedSuffix}`
        : `sessions-export-${Date.now()}.${ext}${encryptedSuffix}`;

      exportApi.downloadBlob(blob, filename);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Select Sessions</h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              All
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              None
            </Button>
          </div>
        </div>
        <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No sessions available</p>
          ) : (
            sessions.map((session) => (
              <SessionCheckbox
                key={session.id}
                session={session}
                checked={selectedIds.has(session.id)}
                onToggle={() => toggleSession(session.id)}
              />
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedIds.size} of {sessions.length} selected
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Export Format</h3>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((f) => {
            const info = FORMAT_INFO[f];
            const Icon = info.icon;
            const disabled = f === 'pdf' && selectedIds.size > 1;
            return (
              <button
                key={f}
                type="button"
                onClick={() => !disabled && setFormat(f)}
                disabled={disabled}
                className={cn(
                  'p-3 rounded-lg border-2 transition-all text-left',
                  format === f
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-1', info.color)} />
                <p className="text-sm font-medium">{info.label}</p>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Options</h3>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeThinking}
            onChange={(e) => setIncludeThinking(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Include thinking/reasoning</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeToolCalls}
            onChange={(e) => setIncludeToolCalls(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Include tool calls</span>
        </label>

        <div className="pt-2 border-t">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="rounded border-border"
            />
            {encrypt ? (
              <Lock className="w-4 h-4 text-amber-500" />
            ) : (
              <Unlock className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm">Encrypt with password (AES-256)</span>
          </label>

          <AnimatePresence>
            {encrypt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="relative mt-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter encryption password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button onClick={handleExport} disabled={loading || selectedIds.size === 0} className="w-full">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export {selectedIds.size} Session{selectedIds.size !== 1 ? 's' : ''}
          </>
        )}
      </Button>
    </div>
  );
}

function ImportPanel({ onSuccess }: { onSuccess: () => void }) {
  const [importMethod, setImportMethod] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState<'json' | 'markdown'>('json');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number; sessions: { name: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await exportApi.readFileAsText(file);
      setFileContent(content);
      setFileName(file.name);
      setError(null);

      if (file.name.endsWith('.md')) {
        setFormat('markdown');
      } else {
        setFormat('json');
      }

      try {
        const parsed = JSON.parse(content);
        if (parsed.encrypted) {
          setNeedsPassword(true);
        } else {
          setNeedsPassword(false);
        }
      } catch {
        setNeedsPassword(false);
      }
    } catch (err) {
      setError('Failed to read file');
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportApi.importSessions({
        content: importMethod === 'file' ? fileContent || undefined : undefined,
        sourceUrl: importMethod === 'url' ? url : undefined,
        format,
        password: needsPassword ? password : undefined,
      });

      setSuccess({
        count: result.count,
        sessions: result.imported.map((s) => ({ name: s.name })),
      });

      setTimeout(() => {
        onSuccess();
        window.location.reload();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      if (message.includes('Password required')) {
        setNeedsPassword(true);
        setError('This file is encrypted. Please enter the password.');
      } else if (message.includes('Decryption failed')) {
        setError('Wrong password. Please try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setFileContent(null);
    setFileName(null);
    setNeedsPassword(false);
    setPassword('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canImport = importMethod === 'file' ? !!fileContent : !!url;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">Import Source</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setImportMethod('file')}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3',
              importMethod === 'file'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <Upload className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Upload File</p>
              <p className="text-xs text-muted-foreground">From your device</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setImportMethod('url')}
            className={cn(
              'p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3',
              importMethod === 'url'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <Link className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium">From URL</p>
              <p className="text-xs text-muted-foreground">Import from link</p>
            </div>
          </button>
        </div>
      </div>

      {importMethod === 'file' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.md,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!fileContent ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors text-center"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">JSON or Markdown files</p>
            </button>
          ) : (
            <div className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {format === 'json' ? (
                  <FileJson className="w-8 h-8 text-amber-500" />
                ) : (
                  <FileText className="w-8 h-8 text-blue-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(fileContent.length / 1024).toFixed(1)} KB
                    {needsPassword && ' • Encrypted'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Input
            type="url"
            placeholder="https://example.com/session-export.json"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste a direct link to an exported session file
          </p>
        </div>
      )}

      {importMethod === 'url' && (
        <div>
          <h3 className="text-sm font-medium mb-2">Format</h3>
          <div className="flex gap-2">
            <Button
              variant={format === 'json' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat('json')}
            >
              <FileJson className="w-4 h-4 mr-2" />
              JSON
            </Button>
            <Button
              variant={format === 'markdown' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat('markdown')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Markdown
            </Button>
          </div>
        </div>
      )}

      {needsPassword && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            Encrypted File
          </h3>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter decryption password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-3 rounded-lg"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Successfully imported {success.count} session{success.count !== 1 ? 's' : ''}!
        </motion.div>
      )}

      <Button
        onClick={handleImport}
        disabled={loading || !canImport || (needsPassword && !password)}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Import Sessions
          </>
        )}
      </Button>
    </div>
  );
}

function SessionCheckbox({
  session,
  checked,
  onToggle,
}: {
  session: Session;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="rounded border-border"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{session.name}</p>
        <p className="text-xs text-muted-foreground">
          {session.messages.length} messages
        </p>
      </div>
    </label>
  );
}
