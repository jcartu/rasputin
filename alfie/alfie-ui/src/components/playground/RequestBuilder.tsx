'use client';

import { motion } from 'framer-motion';
import {
  Plus,
  Trash2,
  Key,
  FileJson,
  FormInput,
  FileText,
  Lock,
  User,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { usePlaygroundStore } from '@/lib/playground/store';
import { KeyValuePair, AuthConfig, RequestBody } from '@/lib/playground/types';

export function RequestBuilder() {
  const {
    currentRequest,
    activeTab,
    setActiveTab,
    addHeader,
    updateHeader,
    removeHeader,
    addQueryParam,
    updateQueryParam,
    removeQueryParam,
    setBody,
    setAuth,
  } = usePlaygroundStore();

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'params' | 'headers' | 'body' | 'auth')}
        className="flex-1 flex flex-col"
      >
        <div className="border-b border-border px-4">
          <TabsList className="h-10 bg-transparent p-0 w-full justify-start gap-6">
            <TabsTrigger
              value="params"
              className="h-10 px-0 pb-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Hash className="w-4 h-4 mr-2" />
              Params
              {currentRequest.queryParams.filter((p) => p.enabled).length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                  {currentRequest.queryParams.filter((p) => p.enabled).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="headers"
              className="h-10 px-0 pb-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <FileText className="w-4 h-4 mr-2" />
              Headers
              {currentRequest.headers.filter((h) => h.enabled).length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                  {currentRequest.headers.filter((h) => h.enabled).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="body"
              className="h-10 px-0 pb-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <FileJson className="w-4 h-4 mr-2" />
              Body
            </TabsTrigger>
            <TabsTrigger
              value="auth"
              className="h-10 px-0 pb-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Lock className="w-4 h-4 mr-2" />
              Auth
              {currentRequest.auth.type !== 'none' && (
                <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="params" className="m-0 p-4">
            <KeyValueEditor
              items={currentRequest.queryParams}
              onAdd={addQueryParam}
              onUpdate={updateQueryParam}
              onRemove={removeQueryParam}
              keyPlaceholder="Parameter name"
              valuePlaceholder="Value"
            />
          </TabsContent>

          <TabsContent value="headers" className="m-0 p-4">
            <KeyValueEditor
              items={currentRequest.headers}
              onAdd={addHeader}
              onUpdate={updateHeader}
              onRemove={removeHeader}
              keyPlaceholder="Header name"
              valuePlaceholder="Value"
            />
          </TabsContent>

          <TabsContent value="body" className="m-0 p-4">
            <BodyEditor
              body={currentRequest.body}
              onChange={setBody}
              method={currentRequest.method}
            />
          </TabsContent>

          <TabsContent value="auth" className="m-0 p-4">
            <AuthEditor auth={currentRequest.auth} onChange={setAuth} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

interface KeyValueEditorProps {
  items: KeyValuePair[];
  onAdd: (item?: Partial<KeyValuePair>) => void;
  onUpdate: (id: string, updates: Partial<KeyValuePair>) => void;
  onRemove: (id: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

function KeyValueEditor({
  items,
  onAdd,
  onUpdate,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
}: KeyValueEditorProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2 group"
        >
          <div className="w-6 flex justify-center">
            <Switch
              checked={item.enabled}
              onCheckedChange={(checked) => onUpdate(item.id, { enabled: checked })}
              className="h-4 w-8"
            />
          </div>
          <Input
            value={item.key}
            onChange={(e) => onUpdate(item.id, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className={cn('flex-1 font-mono text-sm', !item.enabled && 'opacity-50')}
          />
          <Input
            value={item.value}
            onChange={(e) => onUpdate(item.id, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className={cn('flex-1 font-mono text-sm', !item.enabled && 'opacity-50')}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.id)}
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </motion.div>
      ))}

      <Button variant="ghost" onClick={() => onAdd()} className="w-full justify-start gap-2 mt-2">
        <Plus className="w-4 h-4" />
        Add {keyPlaceholder?.toLowerCase() || 'item'}
      </Button>
    </div>
  );
}

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: Partial<RequestBody>) => void;
  method: string;
}

function BodyEditor({ body, onChange, method }: BodyEditorProps) {
  const bodyTypes = [
    { value: 'none', label: 'None', icon: null },
    { value: 'json', label: 'JSON', icon: FileJson },
    { value: 'form-data', label: 'Form Data', icon: FormInput },
    { value: 'x-www-form-urlencoded', label: 'URL Encoded', icon: FormInput },
    { value: 'raw', label: 'Raw', icon: FileText },
  ];

  const isBodyDisabled = ['GET', 'HEAD'].includes(method);

  if (isBodyDisabled) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileJson className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">Body is not available for {method} requests</p>
      </div>
    );
  }

  const handleAddFormData = () => {
    const newItem: KeyValuePair = {
      id: crypto.randomUUID(),
      key: '',
      value: '',
      enabled: true,
    };
    onChange({ formData: [...(body.formData || []), newItem] });
  };

  const handleUpdateFormData = (id: string, updates: Partial<KeyValuePair>) => {
    onChange({
      formData: (body.formData || []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
  };

  const handleRemoveFormData = (id: string) => {
    onChange({
      formData: (body.formData || []).filter((item) => item.id !== id),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {bodyTypes.map((type) => (
          <Button
            key={type.value}
            variant={body.type === type.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange({ type: type.value as RequestBody['type'] })}
            className="gap-2"
          >
            {type.icon && <type.icon className="w-4 h-4" />}
            {type.label}
          </Button>
        ))}
      </div>

      {body.type === 'json' && (
        <div className="space-y-2">
          <Textarea
            value={body.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder='{"key": "value"}'
            className="font-mono text-sm min-h-[300px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Enter valid JSON. Use &#123;&#123;variable&#125;&#125; for environment variables.
          </p>
        </div>
      )}

      {body.type === 'raw' && (
        <Textarea
          value={body.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Enter raw body content..."
          className="font-mono text-sm min-h-[300px] resize-none"
        />
      )}

      {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
        <KeyValueEditor
          items={body.formData || []}
          onAdd={handleAddFormData}
          onUpdate={handleUpdateFormData}
          onRemove={handleRemoveFormData}
          keyPlaceholder="Field name"
          valuePlaceholder="Value"
        />
      )}

      {body.type === 'none' && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileJson className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">This request does not have a body</p>
        </div>
      )}
    </div>
  );
}

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (auth: Partial<AuthConfig>) => void;
}

function AuthEditor({ auth, onChange }: AuthEditorProps) {
  const authTypes = [
    { value: 'none', label: 'No Auth', description: 'No authentication' },
    { value: 'bearer', label: 'Bearer Token', description: 'Authorization: Bearer <token>' },
    { value: 'api-key', label: 'API Key', description: 'API key in header' },
    { value: 'basic', label: 'Basic Auth', description: 'Username and password' },
    { value: 'custom', label: 'Custom', description: 'Custom headers' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {authTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange({ type: type.value as AuthConfig['type'] })}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              auth.type === type.value
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50'
            )}
          >
            <p className="font-medium text-sm">{type.label}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{type.description}</p>
          </button>
        ))}
      </div>

      {auth.type === 'bearer' && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Bearer Token
          </Label>
          <Input
            value={auth.bearerToken || ''}
            onChange={(e) => onChange({ bearerToken: e.target.value })}
            placeholder="Enter your bearer token"
            className="font-mono"
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            Token will be sent as: Authorization: Bearer &lt;token&gt;
          </p>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Header Name
            </Label>
            <Input
              value={auth.apiKeyHeader || 'X-API-Key'}
              onChange={(e) => onChange({ apiKeyHeader: e.target.value })}
              placeholder="X-API-Key"
              className="font-mono"
            />
          </div>
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key
            </Label>
            <Input
              value={auth.apiKey || ''}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              placeholder="Enter your API key"
              className="font-mono"
              type="password"
            />
          </div>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Username
            </Label>
            <Input
              value={auth.basicUsername || ''}
              onChange={(e) => onChange({ basicUsername: e.target.value })}
              placeholder="Username"
            />
          </div>
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Password
            </Label>
            <Input
              value={auth.basicPassword || ''}
              onChange={(e) => onChange({ basicPassword: e.target.value })}
              placeholder="Password"
              type="password"
            />
          </div>
        </div>
      )}

      {auth.type === 'none' && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Lock className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">No authentication configured</p>
          <p className="text-xs mt-1">Select an auth type above to configure</p>
        </div>
      )}
    </div>
  );
}
