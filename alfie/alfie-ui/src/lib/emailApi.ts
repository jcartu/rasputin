import type { Email, EmailAccount, EmailDraft, EmailFolder, SmartReply, EmailSummary, EmailAnalysis, EmailAddress, EmailAttachment } from './emailStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.details || 'Request failed');
  }
  return response.json();
}

export interface EmailProvider {
  id: string;
  name: string;
  configured: boolean;
  oauth: boolean;
}

export const emailApi = {
  async getProviders(): Promise<{ providers: EmailProvider[] }> {
    const response = await fetch(`${API_BASE}/api/email/providers`);
    return handleResponse(response);
  },

  async getAuthUrl(provider: string, redirectUri: string): Promise<{ url: string; state: string }> {
    const response = await fetch(`${API_BASE}/api/email/oauth/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, redirectUri }),
    });
    return handleResponse(response);
  },

  async handleOAuthCallback(provider: string, code: string, state: string, redirectUri: string): Promise<{ accountId: string; email: string; provider: string }> {
    const response = await fetch(`${API_BASE}/api/email/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, code, state, redirectUri }),
    });
    return handleResponse(response);
  },

  async connectImap(config: {
    email: string;
    password: string;
    imapHost: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    useTls?: boolean;
  }): Promise<{ accountId: string; email: string; provider: string }> {
    const response = await fetch(`${API_BASE}/api/email/imap/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return handleResponse(response);
  },

  async getAccounts(): Promise<{ accounts: EmailAccount[] }> {
    const response = await fetch(`${API_BASE}/api/email/accounts`);
    return handleResponse(response);
  },

  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/email/accounts/${accountId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async listEmails(accountId: string, options?: {
    folder?: string;
    limit?: number;
    offset?: number;
    query?: string;
  }): Promise<{ emails: Email[]; count: number }> {
    const params = new URLSearchParams();
    if (options?.folder) params.set('folder', options.folder);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.query) params.set('query', options.query);

    const response = await fetch(
      `${API_BASE}/api/email/accounts/${accountId}/emails?${params}`,
    );
    return handleResponse(response);
  },

  async getEmail(accountId: string, emailId: string): Promise<{ email: Email }> {
    const response = await fetch(
      `${API_BASE}/api/email/accounts/${accountId}/emails/${emailId}`,
    );
    return handleResponse(response);
  },

  async sendEmail(accountId: string, data: {
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    subject: string;
    body?: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
    replyToId?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const response = await fetch(`${API_BASE}/api/email/accounts/${accountId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async markAsRead(accountId: string, emailId: string, isRead: boolean = true): Promise<{ success: boolean }> {
    const response = await fetch(
      `${API_BASE}/api/email/accounts/${accountId}/emails/${emailId}/read`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead }),
      },
    );
    return handleResponse(response);
  },

  async deleteEmail(accountId: string, emailId: string, permanent: boolean = false): Promise<{ success: boolean }> {
    const response = await fetch(
      `${API_BASE}/api/email/accounts/${accountId}/emails/${emailId}?permanent=${permanent}`,
      { method: 'DELETE' },
    );
    return handleResponse(response);
  },

  async getFolders(accountId: string): Promise<{ folders: EmailFolder[] }> {
    const response = await fetch(`${API_BASE}/api/email/accounts/${accountId}/folders`);
    return handleResponse(response);
  },

  async searchEmails(accountId: string, query: string, options?: {
    folder?: string;
    limit?: number;
  }): Promise<{ emails: Email[]; count: number }> {
    const response = await fetch(`${API_BASE}/api/email/accounts/${accountId}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
    return handleResponse(response);
  },

  async getAttachment(accountId: string, emailId: string, attachmentId: string): Promise<{
    content: string;
    contentType?: string;
    filename?: string;
    size: number;
  }> {
    const response = await fetch(
      `${API_BASE}/api/email/accounts/${accountId}/emails/${emailId}/attachments/${attachmentId}`,
    );
    return handleResponse(response);
  },

  async saveDraft(accountId: string, draft: Partial<EmailDraft>): Promise<{ success: boolean; draftId: string }> {
    const response = await fetch(`${API_BASE}/api/email/accounts/${accountId}/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    return handleResponse(response);
  },

  async getDrafts(accountId: string): Promise<{ drafts: EmailDraft[] }> {
    const response = await fetch(`${API_BASE}/api/email/accounts/${accountId}/drafts`);
    return handleResponse(response);
  },

  async deleteDraft(draftId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/email/drafts/${draftId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async getSmartReplies(email: Email, options?: {
    tone?: string;
    count?: number;
  }): Promise<{ suggestions: SmartReply[] }> {
    const response = await fetch(`${API_BASE}/api/email/ai/smart-replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...options }),
    });
    return handleResponse(response);
  },

  async summarizeEmail(emails: Email | Email[], options?: {
    style?: string;
    includeActionItems?: boolean;
  }): Promise<EmailSummary> {
    const response = await fetch(`${API_BASE}/api/email/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, ...options }),
    });
    return handleResponse(response);
  },

  async assistCompose(data: {
    intent: 'draft' | 'improve' | 'shorten' | 'expand' | 'formalize' | 'casualize' | 'translate';
    content: string;
    context?: string;
    tone?: string;
    language?: string;
  }): Promise<{ subject?: string; body: string; changes?: string[] }> {
    const response = await fetch(`${API_BASE}/api/email/ai/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async autocomplete(text: string, context?: {
    subject?: string;
    recipient?: string;
  }): Promise<{ completion: string }> {
    const response = await fetch(`${API_BASE}/api/email/ai/autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
    });
    return handleResponse(response);
  },

  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    const response = await fetch(`${API_BASE}/api/email/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse(response);
  },

  async extractActionItems(email: Email): Promise<{ actionItems: Array<{
    task: string;
    assignee: string;
    deadline: string | null;
    priority: string;
  }> }> {
    const response = await fetch(`${API_BASE}/api/email/ai/action-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse(response);
  },

  async convertToSession(email: Email, options?: {
    includeThread?: boolean;
  }): Promise<{ session: unknown }> {
    const response = await fetch(`${API_BASE}/api/email/convert-to-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...options }),
    });
    return handleResponse(response);
  },

  downloadAttachment(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([Uint8Array.from(atob(content), c => c.charCodeAt(0))], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
