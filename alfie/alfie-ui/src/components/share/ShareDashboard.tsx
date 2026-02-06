'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Share2,
  Link,
  Globe,
  Users,
  Lock,
  Eye,
  Clock,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Shield,
  Camera,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { shareApi, type Share, type ShareStats, type ShareVisibility } from '@/lib/shareApi';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
];

const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All Visibility' },
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' },
];

export function ShareDashboard() {
  const [shares, setShares] = useState<Share[]>([]);
  const [stats, setStats] = useState<ShareStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const [sharesResult, statsResult] = await Promise.all([
        shareApi.list({
          status: statusFilter === 'all' ? undefined : statusFilter as 'active' | 'expired',
          visibility: visibilityFilter === 'all' ? undefined : visibilityFilter as ShareVisibility,
          page,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
        shareApi.getStats(),
      ]);
      setShares(sharesResult.shares);
      setTotalPages(sharesResult.totalPages);
      setStats(statsResult);
    } catch {
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, visibilityFilter, page]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await shareApi.delete(id);
      setShares(shares => shares.filter(s => s.id !== id));
      if (stats) {
        setStats({ ...stats, total: stats.total - 1 });
      }
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

  const filteredShares = shares.filter(share => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      share.title.toLowerCase().includes(query) ||
      share.description?.toLowerCase().includes(query)
    );
  });

  const getVisibilityIcon = (visibility: ShareVisibility) => {
    switch (visibility) {
      case 'public': return <Globe className="w-4 h-4 text-green-500" />;
      case 'unlisted': return <Link className="w-4 h-4 text-blue-500" />;
      case 'private': return <Users className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="w-6 h-6" />
            Share Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage all your shared session links
          </p>
        </div>
        <Button onClick={loadShares} variant="outline" size="sm">
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard icon={Share2} label="Total Shares" value={stats.total} />
          <StatCard icon={Check} label="Active" value={stats.active} color="text-green-500" />
          <StatCard icon={Clock} label="Expired" value={stats.expired} color="text-amber-500" />
          <StatCard icon={Eye} label="Total Views" value={stats.totalViews} color="text-blue-500" />
          <StatCard icon={Shield} label="Protected" value={stats.passwordProtected} color="text-purple-500" />
          <StatCard icon={Camera} label="Snapshots" value={stats.snapshotsCount} color="text-cyan-500" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search shares..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            className="w-36"
          />

          <Select
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
            options={VISIBILITY_OPTIONS}
            className="w-36"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredShares.length === 0 ? (
        <div className="text-center py-12">
          <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No shares found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery ? 'Try a different search term' : 'Create your first share link to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShares.map((share, index) => {
            const isExpired = share.isExpired || (share.expiresAt && new Date(share.expiresAt) < new Date());
            
            return (
              <motion.div
                key={share.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'border rounded-lg p-4',
                  isExpired && 'opacity-60 bg-muted/30'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {getVisibilityIcon(share.visibility)}
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium truncate">{share.title}</h3>
                        {share.hasPassword && (
                          <span className="px-1.5 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded">
                            <Lock className="w-3 h-3 inline mr-1" />
                            Protected
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-1.5 py-0.5 text-xs bg-destructive/10 text-destructive rounded">
                            Expired
                          </span>
                        )}
                        {share.snapshotId && (
                          <span className="px-1.5 py-0.5 text-xs bg-cyan-500/10 text-cyan-500 rounded">
                            <Camera className="w-3 h-3 inline mr-1" />
                            Snapshot
                          </span>
                        )}
                      </div>
                      
                      {share.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {share.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {share.viewCount} view{share.viewCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(share.createdAt).toLocaleDateString()}
                        </span>
                        {share.expiresAt && (
                          <span>
                            Expires: {new Date(share.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                        {share.maxViews && (
                          <span>
                            Max: {share.maxViews} views
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy(share)}
                      title="Copy link"
                    >
                      {copiedId === share.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(shareApi.getShareUrl(share.token), '_blank')}
                      title="Open link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(share.id)}
                      disabled={deletingId === share.id}
                      title="Delete share"
                    >
                      {deletingId === share.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'text-foreground',
}: {
  icon: typeof Share2;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', color)}>{value.toLocaleString()}</p>
    </div>
  );
}

export default ShareDashboard;
