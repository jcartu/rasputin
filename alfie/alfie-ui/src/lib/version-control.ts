import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Message } from './store';

export type { Message } from './store';

export interface Snapshot {
  id: string;
  sessionId: string;
  branchId: string;
  parentId: string | null;
  timestamp: Date;
  label: string;
  description?: string;
  type: 'auto' | 'manual' | 'branch' | 'merge';
  sessionState: {
    messages: Message[];
    name: string;
    metadata?: Record<string, unknown>;
  };
  changelog: ChangeLogEntry[];
  hash: string;
}

export interface Branch {
  id: string;
  sessionId: string;
  name: string;
  description?: string;
  createdAt: Date;
  createdFromSnapshotId: string | null;
  headSnapshotId: string | null;
  isDefault: boolean;
  color: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: Date;
  type: 'message_added' | 'message_edited' | 'message_deleted' | 'session_renamed' | 'metadata_changed' | 'rollback' | 'branch_created' | 'merge';
  description: string;
  details?: {
    messageId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    affectedCount?: number;
  };
}

export interface VersionDiff {
  snapshotA: Snapshot;
  snapshotB: Snapshot;
  changes: DiffChange[];
  summary: {
    messagesAdded: number;
    messagesRemoved: number;
    messagesModified: number;
    totalChanges: number;
  };
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  path: string;
  messageId?: string;
  oldValue?: Message | string;
  newValue?: Message | string;
  contentDiff?: ContentDiff[];
}

export interface ContentDiff {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateHash(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const BRANCH_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#6366f1',
  '#84cc16',
  '#ec4899',
];

function getNextBranchColor(existingBranches: Branch[]): string {
  const usedColors = existingBranches.map(b => b.color);
  const availableColor = BRANCH_COLORS.find(c => !usedColors.includes(c));
  return availableColor || BRANCH_COLORS[existingBranches.length % BRANCH_COLORS.length];
}

export function computeContentDiff(oldText: string, newText: string): ContentDiff[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const result: ContentDiff[] = [];
  
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  let i = m, j = n;
  const changes: ContentDiff[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      changes.unshift({ type: 'equal', value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.unshift({ type: 'insert', value: newWords[j - 1] });
      j--;
    } else {
      changes.unshift({ type: 'delete', value: oldWords[i - 1] });
      i--;
    }
  }
  
  for (const change of changes) {
    const last = result[result.length - 1];
    if (last && last.type === change.type) {
      last.value += change.value;
    } else {
      result.push({ ...change });
    }
  }
  
  return result;
}

interface VersionControlState {
  snapshots: Snapshot[];
  branches: Branch[];
  activeBranchId: Record<string, string>;
  
  selectedSnapshotId: string | null;
  comparisonSnapshotId: string | null;
  isComparing: boolean;
  showVersionPanel: boolean;
  
  createSnapshot: (
    sessionId: string,
    session: Session,
    type: Snapshot['type'],
    label?: string,
    description?: string,
    changelog?: ChangeLogEntry[]
  ) => Snapshot;
  
  getSessionSnapshots: (sessionId: string, branchId?: string) => Snapshot[];
  getSnapshot: (snapshotId: string) => Snapshot | undefined;
  getLatestSnapshot: (sessionId: string, branchId?: string) => Snapshot | undefined;
  deleteSnapshot: (snapshotId: string) => void;
  
  createBranch: (sessionId: string, name: string, fromSnapshotId?: string, description?: string) => Branch;
  getBranches: (sessionId: string) => Branch[];
  getActiveBranch: (sessionId: string) => Branch | undefined;
  setActiveBranch: (sessionId: string, branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  renameBranch: (branchId: string, newName: string) => void;
  
  rollbackToSnapshot: (snapshotId: string) => Session | null;
  
  compareSnapshots: (snapshotIdA: string, snapshotIdB: string) => VersionDiff | null;
  
  selectSnapshot: (snapshotId: string | null) => void;
  setComparisonSnapshot: (snapshotId: string | null) => void;
  toggleComparing: (comparing?: boolean) => void;
  toggleVersionPanel: (show?: boolean) => void;
  
  shouldAutoSnapshot: (sessionId: string, changeType: ChangeLogEntry['type']) => boolean;
  
  cleanupOldSnapshots: (sessionId: string, keepCount?: number) => void;
}

export const useVersionControl = create<VersionControlState>()(
  persist(
    (set, get) => ({
      snapshots: [],
      branches: [],
      activeBranchId: {},
      selectedSnapshotId: null,
      comparisonSnapshotId: null,
      isComparing: false,
      showVersionPanel: false,

      createSnapshot: (sessionId, session, type, label, description, changelog = []) => {
        const state = get();
        let branchId = state.activeBranchId[sessionId];
        
        if (!branchId) {
          const defaultBranch = state.createBranch(sessionId, 'main', undefined, 'Default branch');
          branchId = defaultBranch.id;
        }
        
        const branch = state.branches.find(b => b.id === branchId);
        const parentId = branch?.headSnapshotId || null;
        
        const snapshot: Snapshot = {
          id: generateId(),
          sessionId,
          branchId,
          parentId,
          timestamp: new Date(),
          label: label || `Snapshot ${state.snapshots.filter(s => s.sessionId === sessionId).length + 1}`,
          description,
          type,
          sessionState: {
            messages: JSON.parse(JSON.stringify(session.messages)),
            name: session.name,
          },
          changelog,
          hash: generateHash(session),
        };
        
        set((state) => ({
          snapshots: [...state.snapshots, snapshot],
          branches: state.branches.map(b =>
            b.id === branchId ? { ...b, headSnapshotId: snapshot.id } : b
          ),
        }));
        
        return snapshot;
      },

      getSessionSnapshots: (sessionId, branchId) => {
        const state = get();
        return state.snapshots
          .filter(s => s.sessionId === sessionId && (!branchId || s.branchId === branchId))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      getSnapshot: (snapshotId) => {
        return get().snapshots.find(s => s.id === snapshotId);
      },

      getLatestSnapshot: (sessionId, branchId) => {
        const snapshots = get().getSessionSnapshots(sessionId, branchId);
        return snapshots[0];
      },

      deleteSnapshot: (snapshotId) => {
        set((state) => ({
          snapshots: state.snapshots.filter(s => s.id !== snapshotId),
          selectedSnapshotId: state.selectedSnapshotId === snapshotId ? null : state.selectedSnapshotId,
          comparisonSnapshotId: state.comparisonSnapshotId === snapshotId ? null : state.comparisonSnapshotId,
        }));
      },

      createBranch: (sessionId, name, fromSnapshotId, description) => {
        const state = get();
        const existingBranches = state.branches.filter(b => b.sessionId === sessionId);
        
        const branch: Branch = {
          id: generateId(),
          sessionId,
          name,
          description,
          createdAt: new Date(),
          createdFromSnapshotId: fromSnapshotId || null,
          headSnapshotId: fromSnapshotId || null,
          isDefault: existingBranches.length === 0,
          color: getNextBranchColor(existingBranches),
        };
        
        set((state) => ({
          branches: [...state.branches, branch],
          activeBranchId: {
            ...state.activeBranchId,
            [sessionId]: branch.id,
          },
        }));
        
        return branch;
      },

      getBranches: (sessionId) => {
        return get().branches.filter(b => b.sessionId === sessionId);
      },

      getActiveBranch: (sessionId) => {
        const state = get();
        const branchId = state.activeBranchId[sessionId];
        return state.branches.find(b => b.id === branchId);
      },

      setActiveBranch: (sessionId, branchId) => {
        set((state) => ({
          activeBranchId: {
            ...state.activeBranchId,
            [sessionId]: branchId,
          },
        }));
      },

      deleteBranch: (branchId) => {
        const state = get();
        const branch = state.branches.find(b => b.id === branchId);
        if (!branch || branch.isDefault) return;
        
        set((state) => ({
          branches: state.branches.filter(b => b.id !== branchId),
          snapshots: state.snapshots.filter(s => s.branchId !== branchId),
          activeBranchId: Object.fromEntries(
            Object.entries(state.activeBranchId).map(([sid, bid]) => [
              sid,
              bid === branchId
                ? state.branches.find(b => b.sessionId === branch.sessionId && b.isDefault)?.id || bid
                : bid,
            ])
          ),
        }));
      },

      renameBranch: (branchId, newName) => {
        set((state) => ({
          branches: state.branches.map(b =>
            b.id === branchId ? { ...b, name: newName } : b
          ),
        }));
      },

      rollbackToSnapshot: (snapshotId) => {
        const snapshot = get().getSnapshot(snapshotId);
        if (!snapshot) return null;
        
        const restoredSession: Session = {
          id: snapshot.sessionId,
          name: snapshot.sessionState.name,
          messages: JSON.parse(JSON.stringify(snapshot.sessionState.messages)),
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        };
        
        return restoredSession;
      },

      compareSnapshots: (snapshotIdA, snapshotIdB) => {
        const state = get();
        const snapshotA = state.snapshots.find(s => s.id === snapshotIdA);
        const snapshotB = state.snapshots.find(s => s.id === snapshotIdB);
        
        if (!snapshotA || !snapshotB) return null;
        
        const messagesA = snapshotA.sessionState.messages;
        const messagesB = snapshotB.sessionState.messages;
        
        const messageIdsA = new Set(messagesA.map(m => m.id));
        const messageIdsB = new Set(messagesB.map(m => m.id));
        
        const changes: DiffChange[] = [];
        
        for (const msg of messagesA) {
          if (!messageIdsB.has(msg.id)) {
            changes.push({
              type: 'removed',
              path: `messages/${msg.id}`,
              messageId: msg.id,
              oldValue: msg,
            });
          }
        }
        
        for (const msg of messagesB) {
          if (!messageIdsA.has(msg.id)) {
            changes.push({
              type: 'added',
              path: `messages/${msg.id}`,
              messageId: msg.id,
              newValue: msg,
            });
          }
        }
        
        for (const msgB of messagesB) {
          if (messageIdsA.has(msgB.id)) {
            const msgA = messagesA.find(m => m.id === msgB.id)!;
            if (msgA.content !== msgB.content) {
              changes.push({
                type: 'modified',
                path: `messages/${msgB.id}/content`,
                messageId: msgB.id,
                oldValue: msgA.content,
                newValue: msgB.content,
                contentDiff: computeContentDiff(msgA.content, msgB.content),
              });
            }
          }
        }
        
        if (snapshotA.sessionState.name !== snapshotB.sessionState.name) {
          changes.push({
            type: 'modified',
            path: 'name',
            oldValue: snapshotA.sessionState.name,
            newValue: snapshotB.sessionState.name,
          });
        }
        
        return {
          snapshotA,
          snapshotB,
          changes,
          summary: {
            messagesAdded: changes.filter(c => c.type === 'added' && c.path.startsWith('messages/')).length,
            messagesRemoved: changes.filter(c => c.type === 'removed' && c.path.startsWith('messages/')).length,
            messagesModified: changes.filter(c => c.type === 'modified' && c.path.startsWith('messages/')).length,
            totalChanges: changes.length,
          },
        };
      },

      selectSnapshot: (snapshotId) => {
        set({ selectedSnapshotId: snapshotId });
      },

      setComparisonSnapshot: (snapshotId) => {
        set({ comparisonSnapshotId: snapshotId });
      },

      toggleComparing: (comparing) => {
        set((state) => ({
          isComparing: comparing !== undefined ? comparing : !state.isComparing,
          comparisonSnapshotId: comparing === false ? null : state.comparisonSnapshotId,
        }));
      },

      toggleVersionPanel: (show) => {
        set((state) => ({
          showVersionPanel: show !== undefined ? show : !state.showVersionPanel,
        }));
      },

      shouldAutoSnapshot: (sessionId, changeType) => {
        const state = get();
        const snapshots = state.getSessionSnapshots(sessionId);
        const lastSnapshot = snapshots[0];
        
        if (!lastSnapshot) return true;
        
        const timeSinceLastSnapshot = Date.now() - new Date(lastSnapshot.timestamp).getTime();
        const MIN_INTERVAL_MS = 30000;
        
        if (timeSinceLastSnapshot < MIN_INTERVAL_MS) return false;
        
        const significantChanges: ChangeLogEntry['type'][] = ['rollback', 'branch_created', 'merge'];
        if (significantChanges.includes(changeType)) return true;
        
        if (changeType === 'message_added') {
          const lastMessageCount = lastSnapshot.sessionState.messages.length;
          return lastMessageCount === 0 || lastMessageCount % 5 === 0;
        }
        
        return false;
      },

      cleanupOldSnapshots: (sessionId, keepCount = 50) => {
        set((state) => {
          const sessionSnapshots = state.snapshots
            .filter(s => s.sessionId === sessionId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          const toKeep = new Set(sessionSnapshots.slice(0, keepCount).map(s => s.id));
          
          for (const snapshot of sessionSnapshots) {
            if (snapshot.type === 'branch' || snapshot.type === 'manual') {
              toKeep.add(snapshot.id);
            }
          }
          
          return {
            snapshots: state.snapshots.filter(s =>
              s.sessionId !== sessionId || toKeep.has(s.id)
            ),
          };
        });
      },
    }),
    {
      name: 'alfie-version-control',
      partialize: (state) => ({
        snapshots: state.snapshots,
        branches: state.branches,
        activeBranchId: state.activeBranchId,
      }),
    }
  )
);

export function createChangelogEntry(
  type: ChangeLogEntry['type'],
  description: string,
  details?: ChangeLogEntry['details']
): ChangeLogEntry {
  return {
    id: generateId(),
    timestamp: new Date(),
    type,
    description,
    details,
  };
}
