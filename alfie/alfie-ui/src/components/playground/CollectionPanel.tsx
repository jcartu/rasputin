'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Folder,
  FolderOpen,
  FileJson,
  Trash2,
  Edit3,
  Copy,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Clock,
  Search,
  X,
  Star,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { usePlaygroundStore } from '@/lib/playground/store';
import { ApiRequest, RequestCollection, HTTP_METHOD_COLORS } from '@/lib/playground/types';
import { formatDistanceToNow } from 'date-fns';

export function CollectionPanel() {
  const {
    savedRequests,
    collections,
    history,
    loadRequest,
    deleteSavedRequest,
    duplicateRequest,
    createCollection,
    deleteCollection,
    updateCollection,
    addToCollection,
    removeFromCollection,
    updateSavedRequest,
    clearHistory,
  } = usePlaygroundStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'collections' | 'saved' | 'history'>('saved');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [editingRequest, setEditingRequest] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const filteredRequests = savedRequests.filter((req) =>
    req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      createCollection(newCollectionName.trim(), newCollectionDescription.trim() || undefined);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setShowNewCollectionDialog(false);
    }
  };

  const handleRenameRequest = (id: string) => {
    if (editingName.trim()) {
      updateSavedRequest(id, { name: editingName.trim() });
      setEditingRequest(null);
      setEditingName('');
    }
  };

  const getCollectionRequests = (collection: RequestCollection) => {
    return collection.requests
      .map((id) => savedRequests.find((r) => r.id === id))
      .filter(Boolean) as ApiRequest[];
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requests..."
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex border-b border-border">
        {(['saved', 'collections', 'history'] as const).map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={cn(
              'flex-1 py-2 text-xs font-medium transition-colors capitalize',
              activeSection === section
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {section}
            {section === 'saved' && savedRequests.length > 0 && (
              <span className="ml-1 text-muted-foreground">({savedRequests.length})</span>
            )}
            {section === 'history' && history.length > 0 && (
              <span className="ml-1 text-muted-foreground">({history.length})</span>
            )}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          {activeSection === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-2"
            >
              {filteredRequests.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileJson className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No saved requests</p>
                  <p className="text-xs mt-1">Save a request to see it here</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredRequests.map((request) => (
                    <RequestItem
                      key={request.id}
                      request={request}
                      onLoad={() => loadRequest(request.id)}
                      onDelete={() => deleteSavedRequest(request.id)}
                      onDuplicate={() => duplicateRequest(request.id)}
                      onRename={(name) => {
                        setEditingRequest(request.id);
                        setEditingName(name);
                      }}
                      isEditing={editingRequest === request.id}
                      editingName={editingName}
                      onEditingNameChange={setEditingName}
                      onSaveRename={() => handleRenameRequest(request.id)}
                      onCancelRename={() => {
                        setEditingRequest(null);
                        setEditingName('');
                      }}
                      collections={collections}
                      onAddToCollection={(collectionId) => addToCollection(collectionId, request.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'collections' && (
            <motion.div
              key="collections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-2"
            >
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 mb-2"
                onClick={() => setShowNewCollectionDialog(true)}
              >
                <Plus className="w-4 h-4" />
                New Collection
              </Button>

              {collections.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Folder className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No collections</p>
                  <p className="text-xs mt-1">Create a collection to organize requests</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {collections.map((collection) => (
                    <CollectionItem
                      key={collection.id}
                      collection={collection}
                      requests={getCollectionRequests(collection)}
                      isExpanded={expandedCollections.has(collection.id)}
                      onToggle={() => toggleCollection(collection.id)}
                      onDelete={() => deleteCollection(collection.id)}
                      onLoadRequest={loadRequest}
                      onRemoveRequest={(requestId) => removeFromCollection(collection.id, requestId)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-2"
            >
              {history.length > 0 && (
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Clear History
                  </Button>
                </div>
              )}

              {history.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No history</p>
                  <p className="text-xs mt-1">Your request history will appear here</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((item, index) => (
                    <HistoryItem
                      key={`${item.request.id}-${item.timestamp}`}
                      request={item.request}
                      response={item.response}
                      timestamp={item.timestamp}
                      onLoad={() => loadRequest(item.request.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      <Dialog open={showNewCollectionDialog} onOpenChange={setShowNewCollectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="My Collection"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                placeholder="Describe your collection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCollectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RequestItemProps {
  request: ApiRequest;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (currentName: string) => void;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  collections: RequestCollection[];
  onAddToCollection: (collectionId: string) => void;
}

function RequestItem({
  request,
  onLoad,
  onDelete,
  onDuplicate,
  onRename,
  isEditing,
  editingName,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
  collections,
  onAddToCollection,
}: RequestItemProps) {
  return (
    <div className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <button
        type="button"
        onClick={onLoad}
        className="flex-1 flex items-center gap-2 text-left min-w-0"
      >
        <Badge
          variant="outline"
          className={cn('font-mono text-[10px] w-14 justify-center shrink-0', HTTP_METHOD_COLORS[request.method])}
        >
          {request.method}
        </Badge>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              onBlur={onSaveRename}
              autoFocus
              className="h-6 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <p className="text-sm font-medium truncate">{request.name}</p>
              <p className="text-xs text-muted-foreground truncate font-mono">{request.url}</p>
            </>
          )}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onRename(request.name)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          {collections.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Add to Collection
              </div>
              {collections.map((collection) => (
                <DropdownMenuItem
                  key={collection.id}
                  onClick={() => onAddToCollection(collection.id)}
                >
                  <Folder className="w-4 h-4 mr-2" />
                  {collection.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface CollectionItemProps {
  collection: RequestCollection;
  requests: ApiRequest[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onLoadRequest: (id: string) => void;
  onRemoveRequest: (requestId: string) => void;
}

function CollectionItem({
  collection,
  requests,
  isExpanded,
  onToggle,
  onDelete,
  onLoadRequest,
  onRemoveRequest,
}: CollectionItemProps) {
  return (
    <div>
      <div className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
        <button type="button" onClick={onToggle} className="p-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <button type="button" onClick={onToggle} className="flex-1 flex items-center gap-2 text-left">
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{collection.name}</p>
            <p className="text-xs text-muted-foreground">{requests.length} requests</p>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Collection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-4 border-l border-border overflow-hidden"
          >
            {requests.map((request) => (
              <div
                key={request.id}
                className="group flex items-center gap-2 p-2 ml-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onLoadRequest(request.id)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <Badge
                    variant="outline"
                    className={cn('font-mono text-[10px] w-12 justify-center', HTTP_METHOD_COLORS[request.method])}
                  >
                    {request.method}
                  </Badge>
                  <p className="text-sm truncate">{request.name}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveRequest(request.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {requests.length === 0 && (
              <p className="text-xs text-muted-foreground p-2 ml-2">No requests in collection</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface HistoryItemProps {
  request: ApiRequest;
  response: { status: number; time: number };
  timestamp: string;
  onLoad: () => void;
}

function HistoryItem({ request, response, timestamp, onLoad }: HistoryItemProps) {
  const statusColor =
    response.status >= 200 && response.status < 300
      ? 'text-emerald-500'
      : response.status >= 400
        ? 'text-red-500'
        : 'text-amber-500';

  return (
    <button
      type="button"
      onClick={onLoad}
      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
    >
      <Badge
        variant="outline"
        className={cn('font-mono text-[10px] w-12 justify-center shrink-0', HTTP_METHOD_COLORS[request.method])}
      >
        {request.method}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-mono">{request.url}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={statusColor}>{response.status}</span>
          <span>{response.time}ms</span>
          <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
        </div>
      </div>
    </button>
  );
}
