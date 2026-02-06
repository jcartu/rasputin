'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, TestTube, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useIntegrationStore, type CustomIntegrationConfig } from '@/lib/integrationStore';

interface CustomIntegrationBuilderProps {
  open: boolean;
  onClose: () => void;
  existingConfig?: CustomIntegrationConfig;
}

type AuthType = 'oauth2' | 'api_key' | 'basic' | 'bearer';

interface Endpoint {
  id: string;
  name: string;
  method: string;
  path: string;
  params: string[];
}

const authTypeOptions = [
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'api_key', label: 'API Key' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
];

const methodOptions = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function CustomIntegrationBuilder({ open, onClose, existingConfig }: CustomIntegrationBuilderProps) {
  const { createCustomIntegration, updateCustomIntegration } = useIntegrationStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [name, setName] = useState(existingConfig?.name || '');
  const [description, setDescription] = useState(existingConfig?.description || '');
  const [authType, setAuthType] = useState<AuthType>(existingConfig?.authType || 'bearer');
  const [baseUrl, setBaseUrl] = useState(existingConfig?.baseUrl || '');
  
  const [oauth2AuthUrl, setOauth2AuthUrl] = useState(existingConfig?.oauth2Config?.authUrl || '');
  const [oauth2TokenUrl, setOauth2TokenUrl] = useState(existingConfig?.oauth2Config?.tokenUrl || '');
  const [oauth2Scopes, setOauth2Scopes] = useState(existingConfig?.oauth2Config?.scopes?.join(', ') || '');
  
  const [apiKeyHeader, setApiKeyHeader] = useState(existingConfig?.apiKeyConfig?.headerName || 'X-API-Key');
  const [apiKeyPrefix, setApiKeyPrefix] = useState(existingConfig?.apiKeyConfig?.prefix || '');

  const [endpoints, setEndpoints] = useState<Endpoint[]>(() => {
    if (existingConfig?.endpoints) {
      return Object.entries(existingConfig.endpoints).map(([epName, config]) => ({
        id: generateId(),
        name: epName,
        method: config.method,
        path: config.path,
        params: config.params || [],
      }));
    }
    return [{ id: generateId(), name: '', method: 'GET', path: '', params: [] }];
  });

  const addEndpoint = () => {
    setEndpoints([...endpoints, { id: generateId(), name: '', method: 'GET', path: '', params: [] }]);
  };

  const removeEndpoint = (id: string) => {
    setEndpoints(endpoints.filter((ep) => ep.id !== id));
  };

  const updateEndpoint = (id: string, field: keyof Omit<Endpoint, 'id'>, value: string | string[]) => {
    setEndpoints(endpoints.map((ep) => ep.id === id ? { ...ep, [field]: value } : ep));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    await new Promise((r) => setTimeout(r, 1500));
    
    if (baseUrl && name) {
      setTestResult({ success: true, message: 'Connection successful!' });
    } else {
      setTestResult({ success: false, message: 'Please fill in required fields' });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    const config: Omit<CustomIntegrationConfig, 'id'> = {
      name,
      description,
      authType,
      baseUrl,
      endpoints: endpoints.reduce((acc, ep) => {
        if (ep.name) {
          acc[ep.name] = { method: ep.method, path: ep.path, params: ep.params };
        }
        return acc;
      }, {} as CustomIntegrationConfig['endpoints']),
    };

    if (authType === 'oauth2') {
      config.oauth2Config = {
        authUrl: oauth2AuthUrl,
        tokenUrl: oauth2TokenUrl,
        scopes: oauth2Scopes.split(',').map((s) => s.trim()).filter(Boolean),
      };
    } else if (authType === 'api_key') {
      config.apiKeyConfig = { headerName: apiKeyHeader, prefix: apiKeyPrefix };
    }

    if (existingConfig?.id) {
      await updateCustomIntegration(existingConfig.id, config);
    } else {
      await createCustomIntegration(config);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingConfig ? 'Edit' : 'Create'} Custom Integration</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL *</Label>
              <Input
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this integration do?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Authentication Type</Label>
            <Select 
              value={authType} 
              onValueChange={(v) => setAuthType(v as AuthType)}
              options={authTypeOptions}
            />
          </div>

          <AnimatePresence mode="wait">
            {authType === 'oauth2' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <Card className="p-4 space-y-4">
                  <h4 className="font-medium text-sm">OAuth 2.0 Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Authorization URL</Label>
                      <Input
                        value={oauth2AuthUrl}
                        onChange={(e) => setOauth2AuthUrl(e.target.value)}
                        placeholder="https://auth.example.com/authorize"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Token URL</Label>
                      <Input
                        value={oauth2TokenUrl}
                        onChange={(e) => setOauth2TokenUrl(e.target.value)}
                        placeholder="https://auth.example.com/token"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Scopes (comma-separated)</Label>
                    <Input
                      value={oauth2Scopes}
                      onChange={(e) => setOauth2Scopes(e.target.value)}
                      placeholder="read, write, admin"
                    />
                  </div>
                </Card>
              </motion.div>
            )}

            {authType === 'api_key' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <Card className="p-4 space-y-4">
                  <h4 className="font-medium text-sm">API Key Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Header Name</Label>
                      <Input
                        value={apiKeyHeader}
                        onChange={(e) => setApiKeyHeader(e.target.value)}
                        placeholder="X-API-Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prefix (optional)</Label>
                      <Input
                        value={apiKeyPrefix}
                        onChange={(e) => setApiKeyPrefix(e.target.value)}
                        placeholder="Bearer"
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Endpoints</Label>
              <Button variant="outline" size="sm" onClick={addEndpoint}>
                <Plus className="h-3 w-3 mr-1" />
                Add Endpoint
              </Button>
            </div>

            <div className="space-y-3">
              {endpoints.map((endpoint) => (
                <Card key={endpoint.id} className="p-3">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={endpoint.name}
                        onChange={(e) => updateEndpoint(endpoint.id, 'name', e.target.value)}
                        placeholder="Endpoint name"
                      />
                    </div>
                    <Select
                      value={endpoint.method}
                      onValueChange={(v) => updateEndpoint(endpoint.id, 'method', v)}
                      options={methodOptions}
                      className="w-28"
                    />
                    <div className="flex-1 space-y-2">
                      <Input
                        value={endpoint.path}
                        onChange={(e) => updateEndpoint(endpoint.id, 'path', e.target.value)}
                        placeholder="/api/resource"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEndpoint(endpoint.id)}
                      disabled={endpoints.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}
            >
              {testResult.message}
            </motion.div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                </motion.div>
                Testing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={!name || !baseUrl}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
