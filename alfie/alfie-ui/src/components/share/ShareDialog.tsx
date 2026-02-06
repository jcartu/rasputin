'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Link,
  Lock,
  Unlock,
  Globe,
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  Code,
  Shield,
  Camera,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { shareApi, type Share, type ShareVisibility, type ExpiresIn } from '@/lib/shareApi';
import { useChatStore } from '@/lib/store';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
}

const VISIBILITY_OPTIONS: { value: ShareVisibility; label: string; icon: typeof Globe; description: string }[] = [
  { value: 'public', label: 'Public', icon: Globe, description: 'Anyone with the link can view' },
  { value: 'unlisted', label: 'Unlisted', icon: Link, description: 'Only people with the link' },
  { value: 'private', label: 'Private', icon: Users, description: 'Only specific emails can access' },
];

const EXPIRY_OPTIONS: { value: ExpiresIn; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'never', label: 'Never' },
];

export function ShareDialog({ open, onOpenChange, sessionId }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [existingShares, setExistingShares] = useState<Share[]>([]);

  const sessions = useChatStore((state) => state.sessions);
  const activeSessionId = useChatStore((state) => state.activeSessionId);
  const targetSessionId = sessionId || activeSessionId;

  const loadExistingShares = useCallback(async () => {
    if (!targetSessionId) return;
    try {
      const { shares } = await shareApi.getForSession(targetSessionId);
      setExistingShares(shares);
      if (shares.length > 0) {
        setActiveTab('manage');
      }
    } catch {
      setExistingShares([]);
    }
  }, [targetSessionId]);

  useEffect(() => {
    if (open && targetSessionId) {
      loadExistingShares();
    }
  }, [open, targetSessionId, loadExistingShares]);

  const currentSession = sessions.find(s => s.id === targetSessionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Session
            {currentSession && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {currentSession.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'manage')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="gap-2">
              <Link className="w-4 h-4" />
              Create Link
            </TabsTrigger>
            <TabsTrigger value="manage" className="gap-2">
              <Share2 className="w-4 h-4" />
              Manage ({existingShares.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="flex-1 overflow-auto mt-4">
            <CreateSharePanel
              sessionId={targetSessionId || undefined}
              onSuccess={() => {
                loadExistingShares();
                setActiveTab('manage');
              }}
            />
          </TabsContent>

          <TabsContent value="manage" className="flex-1 overflow-auto mt-4">
            <ManageSharesPanel
              shares={existingShares}
              onRefresh={loadExistingShares}
              onDelete={(id) => setExistingShares(shares => shares.filter(s => s.id !== id))}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CreateSharePanel({ sessionId, onSuccess }: { sessionId?: string; onSuccess: () => void }) {
  const [visibility, setVisibility] = useState<ShareVisibility>('unlisted');
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>('7d');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [viewOnly, setViewOnly] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowEmbed, setAllowEmbed] = useState(false);
  const [createSnapshot, setCreateSnapshot] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');
  const [maxViews, setMaxViews] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdShare, setCreatedShare] = useState<Share | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!sessionId) {
      setError('No session selected');
      return;
    }

    if (usePassword && !password) {
      setError('Password is required when protection is enabled');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const share = await shareApi.create({
        sessionId,
        title: title || undefined,
        description: description || undefined,
        visibility,
        viewOnly,
        allowCopy,
        allowEmbed,
        password: usePassword ? password : undefined,
        expiresIn,
        maxViews: maxViews ? parseInt(maxViews) : undefined,
        allowedEmails: visibility === 'private' && allowedEmails
          ? allowedEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
          : undefined,
        createSnapshot,
      });

      setCreatedShare(share);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdShare) return;
    const url = shareApi.getShareUrl(createdShare.token);
    await shareApi.copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdShare) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <Check className="w-5 h-5" />
            <span className="font-medium">Share link created!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your session is now shareable. Copy the link below to share it.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium mb-1.5 block">Share URL</span>
            <div className="flex gap-2">
              <Input
                value={shareApi.getShareUrl(createdShare.token)}
                readOnly
                className="font-mono text-sm"
                aria-label="Share URL"
              />
              <Button onClick={handleCopy} variant="outline" className="shrink-0" aria-label="Copy URL">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => window.open(shareApi.getShareUrl(createdShare.token), '_blank')}
                aria-label="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {createdShare.allowEmbed && createdShare.embedCode && (
            <div>
              <span className="text-sm font-medium mb-1.5 block">Embed Code</span>
              <div className="relative">
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto font-mono">
                  {shareApi.getEmbedCode(createdShare.token)}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => shareApi.copyToClipboard(shareApi.getEmbedCode(createdShare.token))}
                  aria-label="Copy embed code"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreatedShare(null)} className="flex-1">
              Create Another
            </Button>
            <Button onClick={onSuccess} className="flex-1">
              Done
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-sm font-medium mb-2 block">Visibility</span>
        <div className="grid grid-cols-3 gap-2">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value)}
                className={cn(
                  'p-3 rounded-lg border-2 transition-all text-left',
                  visibility === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-1', visibility === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {visibility === 'private' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <span className="text-sm font-medium mb-1.5 block">Allowed Emails</span>
            <Input
              placeholder="email1@example.com, email2@example.com"
              value={allowedEmails}
              onChange={(e) => setAllowedEmails(e.target.value)}
              aria-label="Allowed emails"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated list of emails that can access</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <span className="text-sm font-medium mb-2 block">Expiration</span>
        <div className="flex flex-wrap gap-2">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setExpiresIn(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-all',
                expiresIn === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security & Permissions
        </h4>

        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
          <div className="flex items-center gap-3">
            {usePassword ? <Lock className="w-4 h-4 text-amber-500" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">Password Protection</p>
              <p className="text-xs text-muted-foreground">Require password to view</p>
            </div>
          </div>
          <Switch checked={usePassword} onCheckedChange={setUsePassword} aria-label="Enable password protection" />
        </div>

        <AnimatePresence>
          {usePassword && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pl-9"
            >
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  aria-label="Share password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">View Only</p>
              <p className="text-xs text-muted-foreground">Viewers cannot interact</p>
            </div>
          </div>
          <Switch checked={viewOnly} onCheckedChange={setViewOnly} aria-label="Enable view only mode" />
        </div>

        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Copy className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Allow Copy</p>
              <p className="text-xs text-muted-foreground">Let viewers copy content</p>
            </div>
          </div>
          <Switch checked={allowCopy} onCheckedChange={setAllowCopy} aria-label="Allow content copying" />
        </div>

        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Code className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Allow Embed</p>
              <p className="text-xs text-muted-foreground">Generate iframe embed code</p>
            </div>
          </div>
          <Switch checked={allowEmbed} onCheckedChange={setAllowEmbed} aria-label="Allow embedding" />
        </div>

        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Camera className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Create Snapshot</p>
              <p className="text-xs text-muted-foreground">Freeze current state (won&apos;t update)</p>
            </div>
          </div>
          <Switch checked={createSnapshot} onCheckedChange={setCreateSnapshot} aria-label="Create snapshot" />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="text-sm font-medium">Optional Details</h4>
        
        <div>
          <span className="text-xs text-muted-foreground mb-1 block">Title</span>
          <Input
            placeholder="Custom title for the share"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Share title"
          />
        </div>

        <div>
          <span className="text-xs text-muted-foreground mb-1 block">Description</span>
          <Input
            placeholder="Brief description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Share description"
          />
        </div>

        <div>
          <span className="text-xs text-muted-foreground mb-1 block">Max Views (optional)</span>
          <Input
            type="number"
            placeholder="Unlimited"
            value={maxViews}
            onChange={(e) => setMaxViews(e.target.value)}
            min={1}
            aria-label="Maximum views"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button onClick={handleCreate} disabled={loading || !sessionId} className="w-full">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Link className="w-4 h-4 mr-2" />
            Create Share Link
          </>
        )}
      </Button>
    </div>
  );
}

function ManageSharesPanel({
  shares,
  onRefresh,
  onDelete,
}: {
  shares: Share[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await shareApi.delete(id);
      onDelete(id);
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (share: Share) => {
    await shareApi.copyToClipboard(shareApi.getShareUrl(share.token));
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerateToken = async (id: string) => {
    try {
      await shareApi.regenerateToken(id);
      onRefresh();
    } catch {
    }
  };

  if (shares.length === 0) {
    return (
      <div className="text-center py-8">
        <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No share links yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create your first share link to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm text-muted-foreground">{shares.length} share link{shares.length !== 1 ? 's' : ''}</p>
        <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh shares">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {shares.map((share) => {
        const isExpanded = expandedId === share.id;
        const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
        
        return (
          <motion.div
            key={share.id}
            layout
            className={cn(
              'border rounded-lg overflow-hidden',
              isExpired && 'opacity-60'
            )}
          >
            <button
              type="button"
              className="w-full p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 text-left"
              onClick={() => setExpandedId(isExpanded ? null : share.id)}
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-3 min-w-0">
                {share.visibility === 'public' && <Globe className="w-4 h-4 text-green-500 shrink-0" />}
                {share.visibility === 'unlisted' && <Link className="w-4 h-4 text-blue-500 shrink-0" />}
                {share.visibility === 'private' && <Users className="w-4 h-4 text-amber-500 shrink-0" />}
                
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{share.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{share.viewCount} view{share.viewCount !== 1 ? 's' : ''}</span>
                    {share.hasPassword && <Lock className="w-3 h-3" />}
                    {isExpired && <span className="text-destructive">Expired</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(share);
                  }}
                  aria-label="Copy share URL"
                >
                  {copiedId === share.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 pt-0 border-t space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Share URL</span>
                      <Input
                        value={shareApi.getShareUrl(share.token)}
                        readOnly
                        className="font-mono text-xs mt-1"
                        aria-label="Share URL"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Created:</span>{' '}
                        {new Date(share.createdAt).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expires:</span>{' '}
                        {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : 'Never'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Visibility:</span>{' '}
                        {share.visibility}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max Views:</span>{' '}
                        {share.maxViews || 'Unlimited'}
                      </div>
                    </div>

                    {share.allowEmbed && (
                      <div>
                        <span className="text-xs text-muted-foreground">Embed Code</span>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto font-mono mt-1">
                          {shareApi.getEmbedCode(share.token)}
                        </pre>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleRegenerateToken(share.id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(shareApi.getShareUrl(share.token), '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(share.id)}
                        disabled={deletingId === share.id}
                        aria-label="Delete share"
                      >
                        {deletingId === share.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

export default ShareDialog;
