// Jupyter Notebook Types - Compatible with .ipynb format

export type CellType = 'code' | 'markdown' | 'raw';

export type OutputType = 
  | 'stream'
  | 'display_data'
  | 'execute_result'
  | 'error';

export interface StreamOutput {
  output_type: 'stream';
  name: 'stdout' | 'stderr';
  text: string;
}

export interface DisplayDataOutput {
  output_type: 'display_data';
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

export interface ExecuteResultOutput {
  output_type: 'execute_result';
  execution_count: number;
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

export interface ErrorOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

export type CellOutput = StreamOutput | DisplayDataOutput | ExecuteResultOutput | ErrorOutput;

export interface MimeBundle {
  'text/plain'?: string;
  'text/html'?: string;
  'text/markdown'?: string;
  'text/latex'?: string;
  'image/png'?: string;
  'image/jpeg'?: string;
  'image/svg+xml'?: string;
  'image/gif'?: string;
  'application/json'?: unknown;
  'application/javascript'?: string;
  'application/vnd.plotly.v1+json'?: unknown;
  'application/vnd.vegalite.v4+json'?: unknown;
  [key: string]: unknown;
}

export interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string;
  metadata: CellMetadata;
  outputs?: CellOutput[];
  execution_count?: number | null;
}

export interface CellMetadata {
  collapsed?: boolean;
  scrolled?: boolean | 'auto';
  trusted?: boolean;
  editable?: boolean;
  deletable?: boolean;
  name?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface NotebookMetadata {
  kernelspec?: KernelSpec;
  language_info?: LanguageInfo;
  title?: string;
  authors?: Author[];
  [key: string]: unknown;
}

export interface KernelSpec {
  name: string;
  display_name: string;
  language?: string;
}

export interface LanguageInfo {
  name: string;
  version?: string;
  mimetype?: string;
  file_extension?: string;
  pygments_lexer?: string;
  codemirror_mode?: string | { name: string; version?: number };
  nbconvert_exporter?: string;
}

export interface Author {
  name: string;
}

export interface NotebookDocument {
  nbformat: number;
  nbformat_minor: number;
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

// Kernel Types
export type KernelStatus = 
  | 'unknown'
  | 'starting'
  | 'idle'
  | 'busy'
  | 'terminating'
  | 'restarting'
  | 'autorestarting'
  | 'dead';

export interface KernelInfo {
  id: string;
  name: string;
  status: KernelStatus;
  lastActivity: string;
  executionState: 'idle' | 'busy';
  connections: number;
}

export interface AvailableKernel {
  name: string;
  spec: KernelSpec;
  resources?: Record<string, string>;
}

// Execution Types
export interface ExecutionRequest {
  cellId: string;
  code: string;
  silent?: boolean;
  storeHistory?: boolean;
  allowStdin?: boolean;
  stopOnError?: boolean;
}

export interface ExecutionResult {
  cellId: string;
  executionCount: number;
  outputs: CellOutput[];
  status: 'ok' | 'error' | 'aborted';
  duration: number;
}

// UI State Types
export interface CellState {
  isEditing: boolean;
  isFocused: boolean;
  isExecuting: boolean;
  isCollapsed: boolean;
  showOutput: boolean;
}

export interface NotebookState {
  id: string;
  name: string;
  path: string;
  document: NotebookDocument;
  isDirty: boolean;
  lastSaved: Date | null;
  kernelId: string | null;
  kernelStatus: KernelStatus;
  activeCellId: string | null;
  selectedCellIds: string[];
  cellStates: Record<string, CellState>;
  executionQueue: string[];
}

// API Response Types
export interface NotebookListItem {
  name: string;
  path: string;
  lastModified: string;
  size: number;
  type: 'notebook';
}

export interface KernelSessionInfo {
  id: string;
  path: string;
  name: string;
  type: string;
  kernel: KernelInfo;
}

// Default cell factory
export function createCell(type: CellType, source = ''): NotebookCell {
  return {
    id: crypto.randomUUID(),
    cell_type: type,
    source,
    metadata: {
      trusted: true,
      editable: true,
      deletable: true,
    },
    ...(type === 'code' ? { outputs: [], execution_count: null } : {}),
  };
}

// Default notebook factory
export function createNotebook(name = 'Untitled'): NotebookDocument {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        name: 'python3',
        display_name: 'Python 3',
        language: 'python',
      },
      language_info: {
        name: 'python',
        version: '3.11',
        mimetype: 'text/x-python',
        file_extension: '.py',
        pygments_lexer: 'ipython3',
        codemirror_mode: { name: 'ipython', version: 3 },
        nbconvert_exporter: 'python',
      },
      title: name,
    },
    cells: [createCell('code')],
  };
}

// Parse ipynb file
export function parseNotebook(content: string): NotebookDocument {
  const doc = JSON.parse(content) as NotebookDocument;
  // Ensure cells have IDs
  doc.cells = doc.cells.map(cell => ({
    ...cell,
    id: cell.id || crypto.randomUUID(),
    outputs: cell.cell_type === 'code' ? (cell.outputs || []) : undefined,
  }));
  return doc;
}

// Serialize notebook to ipynb format
export function serializeNotebook(doc: NotebookDocument): string {
  return JSON.stringify(doc, null, 2);
}

// Convert session messages to notebook
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function sessionToNotebook(
  messages: SessionMessage[],
  sessionName: string
): NotebookDocument {
  const cells: NotebookCell[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      // User messages become markdown cells with quotes
      cells.push(createCell('markdown', `**User:**\n\n${msg.content}`));
    } else if (msg.role === 'assistant') {
      // Assistant messages: extract code blocks as code cells
      const parts = splitCodeBlocks(msg.content);
      for (const part of parts) {
        if (part.isCode) {
          cells.push(createCell('code', part.content));
        } else if (part.content.trim()) {
          cells.push(createCell('markdown', `**Assistant:**\n\n${part.content}`));
        }
      }
    } else if (msg.role === 'system' && msg.content.trim()) {
      cells.push(createCell('markdown', `> **System:** ${msg.content}`));
    }
  }
  
  if (cells.length === 0) {
    cells.push(createCell('markdown', `# ${sessionName}\n\nConverted from chat session.`));
  }
  
  return {
    ...createNotebook(sessionName),
    cells,
  };
}

interface CodeBlockPart {
  content: string;
  isCode: boolean;
  language?: string;
}

function splitCodeBlocks(content: string): CodeBlockPart[] {
  const parts: CodeBlockPart[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = codeBlockRegex.exec(content);
  
  while (match !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push({ content: text.trim(), isCode: false });
      }
    }
    
    const language = match[1] || 'python';
    const code = match[2].trim();
    if (code) {
      const executableLanguages = ['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'r', 'julia', 'bash', 'sh'];
      if (executableLanguages.includes(language.toLowerCase())) {
        parts.push({ content: code, isCode: true, language });
      } else {
        parts.push({ content: `\`\`\`${language}\n${code}\n\`\`\``, isCode: false });
      }
    }
    
    lastIndex = match.index + match[0].length;
    match = codeBlockRegex.exec(content);
  }
  
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim()) {
      parts.push({ content: text.trim(), isCode: false });
    }
  }
  
  return parts;
}
