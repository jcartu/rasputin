'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Grid, List, Plus, RefreshCw, Filter,
  MessageSquare, GitBranch, FileText, HardDrive, Puzzle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIntegrationStore, type Integration, type ConnectedIntegration } from '@/lib/integrationStore';
import { IntegrationCard } from './IntegrationCard';
import { IntegrationDetails } from './IntegrationDetails';
import { OAuthConnectFlow } from './OAuthConnectFlow';
import { CustomIntegrationBuilder } from './CustomIntegrationBuilder';

type ViewMode = 'grid' | 'list';
type CategoryFilter = 'all' | 'communication' | 'project-management' | 'version-control' | 'storage' | 'custom';

const categories: { value: CategoryFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Filter },
  { value: 'communication', label: 'Communication', icon: MessageSquare },
  { value: 'project-management', label: 'Project Management', icon: FileText },
  { value: 'version-control', label: 'Version Control', icon: GitBranch },
  { value: 'storage', label: 'Storage', icon: HardDrive },
  { value: 'custom', label: 'Custom', icon: Puzzle },
];

const defaultIntegrations: Integration[] = [
  { id: 'slack', name: 'Slack', description: 'Connect to Slack workspaces for messaging and notifications', icon: '💬', category: 'communication', authType: 'oauth2', scopes: ['channels:read', 'chat:write'], features: ['Channels', 'Messages', 'Notifications'] },
  { id: 'discord', name: 'Discord', description: 'Connect to Discord servers and channels', icon: '🎮', category: 'communication', authType: 'oauth2', scopes: ['identify', 'guilds'], features: ['Servers', 'Channels', 'Webhooks'] },
  { id: 'github', name: 'GitHub', description: 'Access repositories, issues, and pull requests', icon: '🐙', category: 'version-control', authType: 'oauth2', scopes: ['repo', 'read:user'], features: ['Repos', 'Issues', 'PRs', 'Webhooks'] },
  { id: 'gitlab', name: 'GitLab', description: 'Connect to GitLab projects and merge requests', icon: '🦊', category: 'version-control', authType: 'oauth2', scopes: ['api', 'read_user'], features: ['Projects', 'MRs', 'Issues'] },
  { id: 'linear', name: 'Linear', description: 'Sync issues and projects from Linear', icon: '📐', category: 'project-management', authType: 'oauth2', scopes: ['read', 'write'], features: ['Issues', 'Projects', 'Teams'] },
  { id: 'jira', name: 'Jira', description: 'Connect to Atlassian Jira for issue tracking', icon: '🎫', category: 'project-management', authType: 'oauth2', scopes: ['read:jira-work', 'write:jira-work'], features: ['Issues', 'Projects', 'Boards'] },
  { id: 'notion', name: 'Notion', description: 'Access Notion pages and databases', icon: '📝', category: 'storage', authType: 'oauth2', scopes: ['read', 'insert'], features: ['Pages', 'Databases', 'Search'] },
  { id: 'google-drive', name: 'Google Drive', description: 'Connect to Google Drive files and folders', icon: '📁', category: 'storage', authType: 'oauth2', scopes: ['drive.file'], features: ['Files', 'Folders', 'Sharing'] },
  { id: 'dropbox', name: 'Dropbox', description: 'Access Dropbox files and folders', icon: '📦', category: 'storage', authType: 'oauth2', scopes: ['files.content.read'], features: ['Files', 'Folders', 'Sharing'] },
];

export function IntegrationMarketplace() {
  const { 
    availableIntegrations, 
    connectedIntegrations,
    fetchIntegrations, 
    fetchConnectedIntegrations,
    connectIntegration,
    disconnectIntegration,
    loading,
    error,
    clearError,
  } = useIntegrationStore();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOAuthFlow, setShowOAuthFlow] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  useEffect(() => {
    fetchIntegrations().catch(() => {});
    fetchConnectedIntegrations().catch(() => {});
  }, [fetchIntegrations, fetchConnectedIntegrations]);

  const integrations = availableIntegrations.length > 0 ? availableIntegrations : defaultIntegrations;

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || integration.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [integrations, searchQuery, categoryFilter]);

  const getConnectedStatus = (integrationId: string): ConnectedIntegration | undefined => {
    return connectedIntegrations.find((c) => c.id === integrationId);
  };

  const handleConnect = async (integration: Integration) => {
    setSelectedIntegration(integration);
    try {
      const authUrl = await connectIntegration(integration.id);
      setOauthUrl(authUrl);
      setShowOAuthFlow(true);
    } catch {
      setShowDetails(true);
    }
  };

  const handleManage = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowDetails(true);
  };

  const handleDisconnect = async (integration: Integration) => {
    await disconnectIntegration(integration.id);
  };

  const handleOAuthSuccess = () => {
    fetchConnectedIntegrations();
    setShowOAuthFlow(false);
    setOauthUrl(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-muted-foreground">Connect your favorite tools and services</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchIntegrations(); fetchConnectedIntegrations(); }}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCustomBuilder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Custom Integration
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <TabsList className="hidden sm:flex">
                {categories.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value} className="gap-1">
                    <cat.icon className="h-3 w-3" />
                    <span className="hidden md:inline">{cat.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {connectedIntegrations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              Connected
              <Badge variant="secondary">{connectedIntegrations.length}</Badge>
            </h2>
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
            }>
              {connectedIntegrations.map((connected) => {
                const integration = integrations.find((i) => i.id === connected.id) || {
                  ...connected,
                  features: [],
                };
                return (
                  <IntegrationCard
                    key={connected.id}
                    integration={integration}
                    connected={connected}
                    onConnect={() => handleConnect(integration)}
                    onManage={() => handleManage(integration)}
                    onDisconnect={() => handleDisconnect(integration)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-4">
            {categoryFilter === 'all' ? 'All Integrations' : categories.find((c) => c.value === categoryFilter)?.label}
            <Badge variant="outline" className="ml-2">{filteredIntegrations.length}</Badge>
          </h2>

          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className={viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex flex-col gap-3'
              }
            >
              {filteredIntegrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  connected={getConnectedStatus(integration.id)}
                  onConnect={() => handleConnect(integration)}
                  onManage={() => handleManage(integration)}
                  onDisconnect={() => handleDisconnect(integration)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {filteredIntegrations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No integrations found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {selectedIntegration && (
        <>
          <IntegrationDetails
            integration={selectedIntegration}
            connected={getConnectedStatus(selectedIntegration.id)}
            open={showDetails}
            onClose={() => { setShowDetails(false); setSelectedIntegration(null); }}
            onConnect={() => handleConnect(selectedIntegration)}
            onDisconnect={() => handleDisconnect(selectedIntegration)}
          />

          <OAuthConnectFlow
            integrationName={selectedIntegration.name}
            authUrl={oauthUrl}
            open={showOAuthFlow}
            onClose={() => { setShowOAuthFlow(false); setOauthUrl(null); }}
            onSuccess={handleOAuthSuccess}
            onError={(err) => console.error(err)}
          />
        </>
      )}

      <CustomIntegrationBuilder
        open={showCustomBuilder}
        onClose={() => setShowCustomBuilder(false)}
      />
    </div>
  );
}
