'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { UserPresenceBar } from '@/components/collaboration/UserPresenceBar';
import { CommentsPanel } from '@/components/collaboration/CommentsPanel';
import { useCollaborationStore } from '@/lib/collaboration';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Document {
  id: string;
  title: string;
  language: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  activeUsers?: number;
}

export function CollabPanel() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const {
    isConnected,
    documentId,
    localUser,
    collaborators,
    connect,
    disconnect,
  } = useCollaborationStore();

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const { documents: docs } = await response.json();
      setDocuments(docs || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) return;

    setCreatingDoc(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDocTitle.trim(),
          content: '',
          language: 'javascript',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      const { document } = await response.json();
      setDocuments(prev => [document, ...prev]);
      setNewDocTitle('');
      setSelectedDocId(document.id);
      await handleJoinDocument(document.id);
    } catch (err) {
      console.error('Failed to create document:', err);
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setCreatingDoc(false);
    }
  };

  const handleJoinDocument = async (docId: string) => {
    try {
      setError(null);
      setSelectedDocId(docId);
      
      if (isConnected && documentId !== docId) {
        disconnect();
      }

      await connect(docId, {
        id: localUser?.id || crypto.randomUUID(),
        name: localUser?.name || 'Anonymous',
        color: localUser?.color,
        avatar: localUser?.avatar,
      });
    } catch (err) {
      console.error('Failed to join document:', err);
      setError(err instanceof Error ? err.message : 'Failed to join document');
    }
  };

  const handleLeaveDocument = () => {
    disconnect();
    setSelectedDocId(null);
  };

  if (selectedDocId && isConnected && documentId === selectedDocId) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Collaboration</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeaveDocument}
              className="text-xs"
            >
              Leave
            </Button>
          </div>
          <UserPresenceBar
            collaborators={collaborators}
            localUser={localUser}
            maxVisible={4}
          />
        </div>

        <ScrollArea className="flex-1">
          <CommentsPanel />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border space-y-3">
        <h3 className="font-semibold text-sm">Documents</h3>

        <div className="flex gap-2">
          <Input
            placeholder="New document title..."
            value={newDocTitle}
            onChange={e => setNewDocTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleCreateDocument();
              }
            }}
            disabled={creatingDoc}
            className="text-xs h-8"
          />
          <Button
            size="sm"
            onClick={handleCreateDocument}
            disabled={!newDocTitle.trim() || creatingDoc}
            className="h-8 px-2"
          >
            {creatingDoc ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">No documents yet</p>
              <p className="text-xs mt-1">Create one to get started</p>
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors cursor-pointer',
                  selectedDocId === doc.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium truncate">{doc.title}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {doc.language}
                    </p>
                  </div>
                  {doc.activeUsers && doc.activeUsers > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      {doc.activeUsers}
                    </Badge>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleJoinDocument(doc.id)}
                  disabled={selectedDocId === doc.id && isConnected}
                  className="w-full h-7 text-xs"
                >
                  {selectedDocId === doc.id && isConnected ? 'Joined' : 'Join'}
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
