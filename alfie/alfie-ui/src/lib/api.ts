const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface ExportOptions {
  sessionIds: string[];
  format: 'json' | 'markdown' | 'pdf';
  includeThinking?: boolean;
  includeToolCalls?: boolean;
  encrypt?: boolean;
  password?: string;
}

export interface ImportOptions {
  content?: string;
  format?: 'json' | 'markdown';
  password?: string;
  sourceUrl?: string;
}

export interface ExportFormat {
  id: string;
  name: string;
  description: string;
  batch: boolean;
}

export interface ImportedSession {
  localId: string;
  name: string;
  messageCount: number;
}

export interface FormatInfo {
  export: ExportFormat[];
  import: { id: string; name: string; description: string }[];
  encryption: { supported: boolean; algorithm: string };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.details || 'Request failed');
  }
  return response.json();
}

export const exportApi = {
  async getFormats(): Promise<FormatInfo> {
    const response = await fetch(`${API_BASE}/api/sessions/formats`);
    return handleResponse<FormatInfo>(response);
  },

  async exportSessions(options: ExportOptions): Promise<Blob> {
    const response = await fetch(`${API_BASE}/api/sessions/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(error.error || 'Export failed');
    }

    return response.blob();
  },

  async importSessions(options: ImportOptions): Promise<{ success: boolean; imported: ImportedSession[]; count: number }> {
    const response = await fetch(`${API_BASE}/api/sessions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return handleResponse(response);
  },

  async decryptPreview(content: string, password: string): Promise<{ success: boolean; preview: string; length: number }> {
    const response = await fetch(`${API_BASE}/api/sessions/decrypt-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, password }),
    });
    return handleResponse(response);
  },

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },
};

export const sessionsApi = {
  async list(): Promise<{ sessions: unknown[] }> {
    const response = await fetch(`${API_BASE}/api/sessions`);
    return handleResponse(response);
  },

  async create(projectPath?: string): Promise<unknown> {
    const response = await fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    });
    return handleResponse(response);
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/sessions/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

export interface ExecuteOptions {
  code: string;
  language: string;
  stdin?: string;
  timeout?: number;
  memoryMB?: number;
}

export interface ExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  timedOut: boolean;
  memoryUsed: number | null;
}

export interface SupportedLanguage {
  id: string;
  name: string;
  extension: string;
}

export interface SandboxStatus {
  dockerAvailable: boolean;
  supportedLanguages: SupportedLanguage[];
  defaultLimits: {
    timeout: number;
    memoryMB: number;
    maxOutputBytes: number;
  };
}

export const sandboxApi = {
  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const response = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return handleResponse(response);
  },

  async getLanguages(): Promise<{ languages: SupportedLanguage[] }> {
    const response = await fetch(`${API_BASE}/api/execute/languages`);
    return handleResponse(response);
  },

  async getTemplate(language: string): Promise<{ language: string; template: string; extension: string }> {
    const response = await fetch(`${API_BASE}/api/execute/template/${language}`);
    return handleResponse(response);
  },

  async getStatus(): Promise<SandboxStatus> {
    const response = await fetch(`${API_BASE}/api/execute/status`);
    return handleResponse(response);
  },
};
