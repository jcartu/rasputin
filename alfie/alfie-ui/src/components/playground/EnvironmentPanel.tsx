'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Settings,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Globe,
  Key,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { usePlaygroundStore } from '@/lib/playground/store';
import { Environment, KeyValuePair } from '@/lib/playground/types';

interface EnvironmentPanelProps {
  onClose: () => void;
}

export function EnvironmentPanel({ onClose }: EnvironmentPanelProps) {
  const {
    environments,
    activeEnvironmentId,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
  } = usePlaygroundStore();

  const [showNewEnvDialog, setShowNewEnvDialog] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(
    new Set([activeEnvironmentId || ''])
  );

  const toggleExpanded = (id: string) => {
    setExpandedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateEnvironment = () => {
    if (newEnvName.trim()) {
      const id = createEnvironment(newEnvName.trim());
      setExpandedEnvs((prev) => new Set(prev).add(id));
      setNewEnvName('');
      setShowNewEnvDialog(false);
    }
  };

  const handleAddVariable = (envId: string) => {
    const env = environments.find((e) => e.id === envId);
    if (env) {
      updateEnvironment(envId, {
        variables: [
          ...env.variables,
          { id: crypto.randomUUID(), key: '', value: '', enabled: true },
        ],
      });
    }
  };

  const handleUpdateVariable = (
    envId: string,
    varId: string,
    updates: Partial<KeyValuePair>
  ) => {
    const env = environments.find((e) => e.id === envId);
    if (env) {
      updateEnvironment(envId, {
        variables: env.variables.map((v) => (v.id === varId ? { ...v, ...updates } : v)),
      });
    }
  };

  const handleRemoveVariable = (envId: string, varId: string) => {
    const env = environments.find((e) => e.id === envId);
    if (env) {
      updateEnvironment(envId, {
        variables: env.variables.filter((v) => v.id !== varId),
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Environments
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 border-b border-border">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setShowNewEnvDialog(true)}
        >
          <Plus className="w-4 h-4" />
          New Environment
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {environments.map((env) => (
            <EnvironmentItem
              key={env.id}
              environment={env}
              isActive={env.id === activeEnvironmentId}
              isExpanded={expandedEnvs.has(env.id)}
              onToggle={() => toggleExpanded(env.id)}
              onActivate={() => setActiveEnvironment(env.id)}
              onDelete={() => deleteEnvironment(env.id)}
              onAddVariable={() => handleAddVariable(env.id)}
              onUpdateVariable={(varId, updates) => handleUpdateVariable(env.id, varId, updates)}
              onRemoveVariable={(varId) => handleRemoveVariable(env.id, varId)}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex-shrink-0 p-3 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{'{{VARIABLE}}'}</code> syntax in URLs, headers, and body to reference variables.
        </p>
      </div>

      <Dialog open={showNewEnvDialog} onOpenChange={setShowNewEnvDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Environment</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Environment Name</Label>
            <Input
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              placeholder="Production, Staging, Development..."
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateEnvironment();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEnvDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEnvironment} disabled={!newEnvName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EnvironmentItemProps {
  environment: Environment;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onAddVariable: () => void;
  onUpdateVariable: (varId: string, updates: Partial<KeyValuePair>) => void;
  onRemoveVariable: (varId: string) => void;
}

function EnvironmentItem({
  environment,
  isActive,
  isExpanded,
  onToggle,
  onActivate,
  onDelete,
  onAddVariable,
  onUpdateVariable,
  onRemoveVariable,
}: EnvironmentItemProps) {
  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        isActive ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={onToggle} className="p-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <Globe className={cn('w-4 h-4', isActive && 'text-primary')} />
          <span className="font-medium text-sm">{environment.name}</span>
          {isActive && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
              Active
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          {!isActive && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onActivate}>
              Use
            </Button>
          )}
          {environment.id !== 'default' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {environment.variables.map((variable) => (
                <div key={variable.id} className="flex items-center gap-2 group">
                  <Switch
                    checked={variable.enabled}
                    onCheckedChange={(checked) =>
                      onUpdateVariable(variable.id, { enabled: checked })
                    }
                    className="h-4 w-7"
                  />
                  <Input
                    value={variable.key}
                    onChange={(e) => onUpdateVariable(variable.id, { key: e.target.value })}
                    placeholder="Variable name"
                    className={cn(
                      'flex-1 h-8 text-xs font-mono',
                      !variable.enabled && 'opacity-50'
                    )}
                  />
                  <Input
                    value={variable.value}
                    onChange={(e) => onUpdateVariable(variable.id, { value: e.target.value })}
                    placeholder="Value"
                    className={cn(
                      'flex-1 h-8 text-xs font-mono',
                      !variable.enabled && 'opacity-50'
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemoveVariable(variable.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={onAddVariable}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Variable
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
