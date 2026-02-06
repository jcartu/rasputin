'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Save,
  Loader2,
  Code2,
  History,
  Settings2,
  Wifi,
  WifiOff,
  Globe,
  ChevronDown,
  FolderOpen,
  Plus,
  Copy,
  Check,
  Sparkles,
  Zap,
  Clock,
  FileJson,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { usePlaygroundStore } from '@/lib/playground/store';
import {
  HttpMethod,
  HTTP_METHOD_COLORS,
  ALFIE_ENDPOINTS,
  EndpointDefinition,
} from '@/lib/playground/types';
import { generateCode, CODE_LANGUAGE_INFO } from '@/lib/playground/codeGen';
import { RequestBuilder } from './RequestBuilder';
import { ResponseViewer } from './ResponseViewer';
import { CollectionPanel } from './CollectionPanel';
import { WebSocketTester } from './WebSocketTester';
import { CodeGenerator } from './CodeGenerator';
import { EnvironmentPanel } from './EnvironmentPanel';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function ApiPlayground() {
  const {
    currentRequest,
    currentResponse,
    isLoading,
    error,
    viewMode,
    showCollections,
    showCodeGenerator,
    setMethod,
    setUrl,
    setResponse,
    setLoading,
    setError,
    setViewMode,
    setShowCollections,
    setShowCodeGenerator,
    saveRequest,
    addToHistory,
    resolveVariables,
  } = usePlaygroundStore();

  const [showEndpoints, setShowEndpoints] = useState(false);
  const [showEnvironment, setShowEnvironment] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleSendRequest = useCallback(async () => {
    if (!currentRequest.url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    const startTime = performance.now();

    try {
      const resolvedUrl = resolveVariables(currentRequest.url);
      const headers: Record<string, string> = {};

      currentRequest.headers
        .filter((h) => h.enabled && h.key)
        .forEach((h) => {
          headers[h.key] = resolveVariables(h.value);
        });

      if (currentRequest.auth.type === 'bearer' && currentRequest.auth.bearerToken) {
        headers['Authorization'] = `Bearer ${resolveVariables(currentRequest.auth.bearerToken)}`;
      } else if (currentRequest.auth.type === 'api-key' && currentRequest.auth.apiKey) {
        headers[currentRequest.auth.apiKeyHeader || 'X-API-Key'] = resolveVariables(
          currentRequest.auth.apiKey
        );
      } else if (currentRequest.auth.type === 'basic' && currentRequest.auth.basicUsername) {
        const credentials = btoa(
          `${currentRequest.auth.basicUsername}:${currentRequest.auth.basicPassword || ''}`
        );
        headers['Authorization'] = `Basic ${credentials}`;
      }

      let url = resolvedUrl;
      const enabledParams = currentRequest.queryParams.filter((p) => p.enabled && p.key);
      if (enabledParams.length > 0) {
        const queryString = enabledParams
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(resolveVariables(p.value))}`)
          .join('&');
        url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }

      const fetchOptions: RequestInit = {
        method: currentRequest.method,
        headers,
      };

      if (
        currentRequest.body.type !== 'none' &&
        currentRequest.body.content &&
        !['GET', 'HEAD'].includes(currentRequest.method)
      ) {
        fetchOptions.body = resolveVariables(currentRequest.body.content);
      }

      const response = await fetch(url, fetchOptions);
      const endTime = performance.now();

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '[Unable to read response body]';
      }

      const apiResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyText,
        size: new Blob([bodyText]).size,
        time: Math.round(endTime - startTime),
        timestamp: new Date().toISOString(),
      };

      setResponse(apiResponse);
      addToHistory(currentRequest, apiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [currentRequest, resolveVariables, setLoading, setError, setResponse, addToHistory]);

  const handleSaveRequest = useCallback(() => {
    saveRequest();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [saveRequest]);

  const handleSelectEndpoint = useCallback(
    (endpoint: EndpointDefinition) => {
      const baseUrl = '{{BASE_URL}}';
      setMethod(endpoint.method);
      setUrl(`${baseUrl}${endpoint.path}`);
      setShowEndpoints(false);

      if (endpoint.requestBody?.example) {
        usePlaygroundStore.getState().setBody({
          type: 'json',
          content: endpoint.requestBody.example,
        });
      }
    },
    [setMethod, setUrl]
  );

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(currentRequest.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentRequest.url]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRequest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSendRequest, handleSaveRequest]);

  const endpointCategories = ALFIE_ENDPOINTS.reduce(
    (acc, endpoint) => {
      if (!acc[endpoint.category]) {
        acc[endpoint.category] = [];
      }
      acc[endpoint.category].push(endpoint);
      return acc;
    },
    {} as Record<string, EndpointDefinition[]>
  );

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        <div className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-xl">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 10px hsl(262 83% 58% / 0.3)',
                      '0 0 20px hsl(262 83% 58% / 0.5)',
                      '0 0 10px hsl(262 83% 58% / 0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                >
                  <Zap className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="font-bold text-lg">API Playground</h1>
                  <p className="text-xs text-muted-foreground">Test ALFIE API endpoints</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Tabs
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as 'rest' | 'websocket')}
                  className="h-9"
                >
                  <TabsList className="h-9">
                    <TabsTrigger value="rest" className="gap-2 px-3">
                      <Globe className="w-4 h-4" />
                      REST
                    </TabsTrigger>
                    <TabsTrigger value="websocket" className="gap-2 px-3">
                      <Wifi className="w-4 h-4" />
                      WebSocket
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCollections(!showCollections)}
                  className={cn(showCollections && 'bg-muted')}
                >
                  <FolderOpen className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEnvironment(!showEnvironment)}
                  className={cn(showEnvironment && 'bg-muted')}
                >
                  <Settings2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {viewMode === 'rest' && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-28 justify-between font-mono font-bold',
                        HTTP_METHOD_COLORS[currentRequest.method]
                      )}
                    >
                      {currentRequest.method}
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-28">
                    {HTTP_METHODS.map((method) => (
                      <DropdownMenuItem
                        key={method}
                        onClick={() => setMethod(method)}
                        className={cn('font-mono font-bold', HTTP_METHOD_COLORS[method])}
                      >
                        {method}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex-1 relative">
                  <Input
                    ref={urlInputRef}
                    value={currentRequest.url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter request URL or select an endpoint..."
                    className="font-mono text-sm pr-20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        handleSendRequest();
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCopyUrl}
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy URL</TooltipContent>
                    </Tooltip>

                    <DropdownMenu open={showEndpoints} onOpenChange={setShowEndpoints}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <FileJson className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
                        <div className="p-2 border-b border-border">
                          <p className="text-sm font-medium">ALFIE API Endpoints</p>
                          <p className="text-xs text-muted-foreground">
                            Select an endpoint to populate the request
                          </p>
                        </div>
                        {Object.entries(endpointCategories).map(([category, endpoints]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                              {category}
                            </div>
                            {endpoints.map((endpoint) => (
                              <DropdownMenuItem
                                key={endpoint.id}
                                onClick={() => handleSelectEndpoint(endpoint)}
                                className="flex items-center gap-2 py-2"
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono text-[10px] w-16 justify-center',
                                    HTTP_METHOD_COLORS[endpoint.method]
                                  )}
                                >
                                  {endpoint.method}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{endpoint.name}</p>
                                  <p className="text-xs text-muted-foreground font-mono truncate">
                                    {endpoint.path}
                                  </p>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <Button
                  onClick={handleSendRequest}
                  disabled={isLoading || !currentRequest.url}
                  className="gap-2 min-w-24"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Send
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSaveRequest}
                      className={cn(saveSuccess && 'border-emerald-500 text-emerald-500')}
                    >
                      {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save Request (⌘S)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowCodeGenerator(!showCodeGenerator)}
                      className={cn(showCodeGenerator && 'bg-muted')}
                    >
                      <Code2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate Code</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="wait">
            {showCollections && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-r border-border bg-card/30 overflow-hidden"
              >
                <CollectionPanel />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col overflow-hidden">
            {viewMode === 'rest' ? (
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
                  <RequestBuilder />
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                  <ResponseViewer />
                </div>
              </div>
            ) : (
              <WebSocketTester />
            )}
          </div>

          <AnimatePresence mode="wait">
            {showCodeGenerator && viewMode === 'rest' && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 400, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-border bg-card/30 overflow-hidden"
              >
                <CodeGenerator />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {showEnvironment && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-border bg-card/30 overflow-hidden"
              >
                <EnvironmentPanel onClose={() => setShowEnvironment(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg shadow-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            {error}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-destructive-foreground/10"
              onClick={() => setError(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ApiPlayground;
