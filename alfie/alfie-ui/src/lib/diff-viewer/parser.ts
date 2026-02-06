import type { FileDiff, DiffHunk, DiffLine, ParsedGitDiff, MergeConflict } from './types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    toml: 'toml',
    ini: 'ini',
    conf: 'plaintext',
    txt: 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
}

export function parseGitDiff(diffText: string): ParsedGitDiff {
  const files: FileDiff[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  const fileDiffPattern = /diff --git a\/(.*?) b\/(.*?)(?:\n|$)/g;
  const fileDiffs = diffText.split(/(?=diff --git)/);

  for (const fileDiffText of fileDiffs) {
    if (!fileDiffText.trim() || !fileDiffText.startsWith('diff --git')) continue;

    const headerMatch = fileDiffText.match(/diff --git a\/(.*?) b\/(.*)/);
    if (!headerMatch) continue;

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];

    let status: FileDiff['status'] = 'modified';
    if (fileDiffText.includes('new file mode')) {
      status = 'added';
    } else if (fileDiffText.includes('deleted file mode')) {
      status = 'deleted';
    } else if (fileDiffText.includes('rename from')) {
      status = 'renamed';
    } else if (fileDiffText.includes('copy from')) {
      status = 'copied';
    }

    const binary = fileDiffText.includes('Binary files');
    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;

    if (!binary) {
      const hunkPattern = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?/g;
      const hunkMatches: { match: RegExpMatchArray; index: number }[] = [];

      let hunkMatch: RegExpExecArray | null = hunkPattern.exec(fileDiffText);
      while (hunkMatch !== null) {
        hunkMatches.push({ match: hunkMatch, index: hunkMatch.index });
        hunkMatch = hunkPattern.exec(fileDiffText);
      }

      for (let i = 0; i < hunkMatches.length; i++) {
        const { match, index } = hunkMatches[i];
        const nextIndex = hunkMatches[i + 1]?.index || fileDiffText.length;
        const hunkContent = fileDiffText.slice(index, nextIndex);

        const oldStart = parseInt(match[1], 10);
        const oldLines = parseInt(match[2] || '1', 10);
        const newStart = parseInt(match[3], 10);
        const newLines = parseInt(match[4] || '1', 10);
        const header = match[5]?.trim() || '';

        const lines: DiffLine[] = [];
        const contentLines = hunkContent.split('\n').slice(1);

        let oldLineNum = oldStart;
        let newLineNum = newStart;

        for (const line of contentLines) {
          if (line === '' && contentLines.indexOf(line) === contentLines.length - 1) continue;

          const prefix = line[0];
          const content = line.slice(1);

          if (prefix === '+') {
            lines.push({
              lineNumber: newLineNum,
              content,
              type: 'addition',
              oldLineNumber: null,
              newLineNumber: newLineNum++,
            });
            additions++;
          } else if (prefix === '-') {
            lines.push({
              lineNumber: oldLineNum,
              content,
              type: 'deletion',
              oldLineNumber: oldLineNum++,
              newLineNumber: null,
            });
            deletions++;
          } else if (prefix === ' ' || prefix === undefined) {
            lines.push({
              lineNumber: oldLineNum,
              content: content || '',
              type: 'context',
              oldLineNumber: oldLineNum++,
              newLineNumber: newLineNum++,
            });
          }
        }

        hunks.push({
          id: generateId(),
          oldStart,
          oldLines,
          newStart,
          newLines,
          header,
          lines,
          isCollapsed: false,
        });
      }
    }

    totalAdditions += additions;
    totalDeletions += deletions;

    files.push({
      id: generateId(),
      oldPath,
      newPath,
      status,
      hunks,
      language: getLanguageFromPath(newPath || oldPath),
      binary,
      additions,
      deletions,
    });
  }

  return {
    files,
    stats: {
      filesChanged: files.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    },
  };
}

export function parseUnifiedDiff(oldContent: string, newContent: string): DiffHunk[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunks: DiffHunk[] = [];

  const lcs = computeLCS(oldLines, newLines);
  const diffLines = buildDiffFromLCS(oldLines, newLines, lcs);

  let currentHunk: DiffHunk | null = null;
  let contextBuffer: DiffLine[] = [];
  const CONTEXT_LINES = 3;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    if (line.type === 'context') {
      if (currentHunk) {
        if (contextBuffer.length < CONTEXT_LINES) {
          currentHunk.lines.push(line);
          contextBuffer.push(line);
        } else {
          const lookAhead = diffLines.slice(i + 1, i + 1 + CONTEXT_LINES * 2);
          const hasMoreChanges = lookAhead.some((l) => l.type !== 'context');

          if (hasMoreChanges) {
            currentHunk.lines.push(line);
          } else {
            hunks.push(currentHunk);
            currentHunk = null;
            contextBuffer = [];
          }
        }
      } else {
        contextBuffer.push(line);
        if (contextBuffer.length > CONTEXT_LINES) {
          contextBuffer.shift();
        }
      }
    } else {
      if (!currentHunk) {
        currentHunk = {
          id: generateId(),
          oldStart: (line.oldLineNumber || 1) - contextBuffer.length,
          oldLines: 0,
          newStart: (line.newLineNumber || 1) - contextBuffer.length,
          newLines: 0,
          header: '',
          lines: [...contextBuffer],
          isCollapsed: false,
        };
      }
      currentHunk.lines.push(line);
      contextBuffer = [];
    }
  }

  if (currentHunk && currentHunk.lines.some((l) => l.type !== 'context')) {
    hunks.push(currentHunk);
  }

  for (const hunk of hunks) {
    hunk.oldLines = hunk.lines.filter((l) => l.type === 'deletion' || l.type === 'context').length;
    hunk.newLines = hunk.lines.filter((l) => l.type === 'addition' || l.type === 'context').length;
  }

  return hunks;
}

function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

function buildDiffFromLCS(oldLines: string[], newLines: string[], dp: number[][]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  const changes: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      changes.unshift({
        lineNumber: i,
        content: oldLines[i - 1],
        type: 'context',
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.unshift({
        lineNumber: j,
        content: newLines[j - 1],
        type: 'addition',
        oldLineNumber: null,
        newLineNumber: j,
      });
      j--;
    } else {
      changes.unshift({
        lineNumber: i,
        content: oldLines[i - 1],
        type: 'deletion',
        oldLineNumber: i,
        newLineNumber: null,
      });
      i--;
    }
  }

  return changes;
}

export function parseMergeConflicts(content: string, filePath: string): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  const lines = content.split('\n');

  let inConflict = false;
  let conflictStart = 0;
  let oursContent: string[] = [];
  let theirsContent: string[] = [];
  let baseContent: string[] = [];
  let oursLabel = 'HEAD';
  let theirsLabel = 'incoming';
  let inOurs = false;
  let inBase = false;
  let inTheirs = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      inOurs = true;
      conflictStart = i + 1;
      oursLabel = line.slice(8).trim() || 'HEAD';
      oursContent = [];
      theirsContent = [];
      baseContent = [];
    } else if (line.startsWith('|||||||') && inConflict) {
      inOurs = false;
      inBase = true;
    } else if (line.startsWith('=======') && inConflict) {
      inOurs = false;
      inBase = false;
      inTheirs = true;
    } else if (line.startsWith('>>>>>>>') && inConflict) {
      theirsLabel = line.slice(8).trim() || 'incoming';

      conflicts.push({
        id: generateId(),
        filePath,
        startLine: conflictStart,
        endLine: i + 1,
        oursContent: oursContent.join('\n'),
        theirsContent: theirsContent.join('\n'),
        baseContent: baseContent.length > 0 ? baseContent.join('\n') : undefined,
        oursLabel,
        theirsLabel,
      });

      inConflict = false;
      inOurs = false;
      inBase = false;
      inTheirs = false;
    } else if (inConflict) {
      if (inOurs) {
        oursContent.push(line);
      } else if (inBase) {
        baseContent.push(line);
      } else if (inTheirs) {
        theirsContent.push(line);
      }
    }
  }

  return conflicts;
}

export function resolveConflict(
  content: string,
  conflict: MergeConflict,
  resolution: 'ours' | 'theirs' | 'both' | 'custom',
  customContent?: string
): string {
  const lines = content.split('\n');
  let resolvedContent: string;

  switch (resolution) {
    case 'ours':
      resolvedContent = conflict.oursContent;
      break;
    case 'theirs':
      resolvedContent = conflict.theirsContent;
      break;
    case 'both':
      resolvedContent = `${conflict.oursContent}\n${conflict.theirsContent}`;
      break;
    case 'custom':
      resolvedContent = customContent || '';
      break;
    default:
      resolvedContent = conflict.oursContent;
  }

  const conflictStartIndex = lines.findIndex((l, i) =>
    l.startsWith('<<<<<<<') && i + 1 >= conflict.startLine - 5 && i + 1 <= conflict.startLine + 5
  );

  if (conflictStartIndex === -1) return content;

  let conflictEndIndex = conflictStartIndex;
  for (let i = conflictStartIndex; i < lines.length; i++) {
    if (lines[i].startsWith('>>>>>>>')) {
      conflictEndIndex = i;
      break;
    }
  }

  const resolvedLines = resolvedContent.split('\n');
  lines.splice(conflictStartIndex, conflictEndIndex - conflictStartIndex + 1, ...resolvedLines);

  return lines.join('\n');
}

export function reconstructFileContent(hunks: DiffHunk[], side: 'old' | 'new'): string {
  const lines: string[] = [];

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (side === 'old') {
        if (line.type === 'context' || line.type === 'deletion') {
          lines.push(line.content);
        }
      } else {
        if (line.type === 'context' || line.type === 'addition') {
          lines.push(line.content);
        }
      }
    }
  }

  return lines.join('\n');
}

export function getDiffStats(files: FileDiff[]): {
  additions: number;
  deletions: number;
  filesChanged: number;
} {
  let additions = 0;
  let deletions = 0;

  for (const file of files) {
    additions += file.additions;
    deletions += file.deletions;
  }

  return {
    additions,
    deletions,
    filesChanged: files.length,
  };
}
