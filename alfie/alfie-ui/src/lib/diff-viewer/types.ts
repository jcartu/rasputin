export type DiffViewMode = 'split' | 'unified';

export interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: 'addition' | 'deletion' | 'context' | 'header';
  oldLineNumber?: number | null;
  newLineNumber?: number | null;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
  isCollapsed: boolean;
}

export interface FileDiff {
  id: string;
  oldPath: string;
  newPath: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied';
  hunks: DiffHunk[];
  oldContent?: string;
  newContent?: string;
  language?: string;
  binary?: boolean;
  additions: number;
  deletions: number;
}

export interface DiffComment {
  id: string;
  filePath: string;
  lineNumber: number;
  side: 'old' | 'new';
  content: string;
  author: string;
  authorAvatar?: string;
  createdAt: Date;
  updatedAt?: Date;
  resolved: boolean;
  replies: DiffCommentReply[];
}

export interface DiffCommentReply {
  id: string;
  content: string;
  author: string;
  authorAvatar?: string;
  createdAt: Date;
}

export interface MergeConflict {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;
  oursLabel: string;
  theirsLabel: string;
  resolution?: 'ours' | 'theirs' | 'both' | 'custom';
  customResolution?: string;
}

export interface ParsedGitDiff {
  files: FileDiff[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

export interface DiffViewerConfig {
  viewMode: DiffViewMode;
  showLineNumbers: boolean;
  syntaxHighlighting: boolean;
  wordWrap: boolean;
  contextLines: number;
  expandAllHunks: boolean;
  showWhitespace: boolean;
}

export const DEFAULT_DIFF_CONFIG: DiffViewerConfig = {
  viewMode: 'split',
  showLineNumbers: true,
  syntaxHighlighting: true,
  wordWrap: false,
  contextLines: 3,
  expandAllHunks: false,
  showWhitespace: false,
};
