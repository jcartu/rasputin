import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  content?: string;
}

export interface Email {
  id: string;
  threadId?: string;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  htmlBody?: string;
  date: Date;
  labels?: string[];
  isRead: boolean;
  isStarred?: boolean;
  snippet?: string;
  attachments?: EmailAttachment[];
}

export interface EmailDraft {
  id: string;
  accountId: string;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject?: string;
  body?: string;
  htmlBody?: string;
  replyToId?: string;
  attachments?: EmailAttachment[];
  updatedAt: Date;
}

export interface EmailAccount {
  id: string;
  provider: 'gmail' | 'outlook' | 'imap';
  email: string;
  createdAt: Date;
}

export interface EmailFolder {
  id: string;
  name: string;
  type?: string;
  unreadCount?: number;
  totalCount?: number;
}

export interface SmartReply {
  type: 'positive' | 'neutral' | 'decline';
  text: string;
}

export interface EmailSummary {
  summary: string;
  actionItems: string[];
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface EmailAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'high' | 'medium' | 'low';
  category: string;
  isUrgent: boolean;
  requiresResponse: boolean;
  suggestedDeadline?: string;
}

type EmailView = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'starred' | 'all';

interface EmailState {
  accounts: EmailAccount[];
  activeAccountId: string | null;
  emails: Email[];
  selectedEmailId: string | null;
  drafts: EmailDraft[];
  folders: EmailFolder[];
  
  currentView: EmailView;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  
  composeOpen: boolean;
  composeDraft: EmailDraft | null;
  
  smartReplies: SmartReply[];
  emailSummary: EmailSummary | null;
  emailAnalysis: EmailAnalysis | null;
  
  setAccounts: (accounts: EmailAccount[]) => void;
  setActiveAccount: (accountId: string | null) => void;
  addAccount: (account: EmailAccount) => void;
  removeAccount: (accountId: string) => void;
  
  setEmails: (emails: Email[]) => void;
  addEmails: (emails: Email[]) => void;
  updateEmail: (emailId: string, updates: Partial<Email>) => void;
  selectEmail: (emailId: string | null) => void;
  
  setDrafts: (drafts: EmailDraft[]) => void;
  addDraft: (draft: EmailDraft) => void;
  updateDraft: (draftId: string, updates: Partial<EmailDraft>) => void;
  removeDraft: (draftId: string) => void;
  
  setFolders: (folders: EmailFolder[]) => void;
  setCurrentView: (view: EmailView) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  openCompose: (draft?: EmailDraft | null) => void;
  closeCompose: () => void;
  updateComposeDraft: (updates: Partial<EmailDraft>) => void;
  
  setSmartReplies: (replies: SmartReply[]) => void;
  setEmailSummary: (summary: EmailSummary | null) => void;
  setEmailAnalysis: (analysis: EmailAnalysis | null) => void;
  
  getSelectedEmail: () => Email | undefined;
  getUnreadCount: () => number;
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeAccountId: null,
      emails: [],
      selectedEmailId: null,
      drafts: [],
      folders: [],
      
      currentView: 'inbox',
      searchQuery: '',
      isLoading: false,
      error: null,
      
      composeOpen: false,
      composeDraft: null,
      
      smartReplies: [],
      emailSummary: null,
      emailAnalysis: null,
      
      setAccounts: (accounts) => set({ accounts }),
      setActiveAccount: (accountId) => set({ activeAccountId: accountId }),
      addAccount: (account) => set((state) => ({
        accounts: [...state.accounts, account],
        activeAccountId: state.activeAccountId || account.id
      })),
      removeAccount: (accountId) => set((state) => ({
        accounts: state.accounts.filter(a => a.id !== accountId),
        activeAccountId: state.activeAccountId === accountId 
          ? state.accounts[0]?.id || null 
          : state.activeAccountId
      })),
      
      setEmails: (emails) => set({ emails }),
      addEmails: (emails) => set((state) => {
        const existingIds = new Set(state.emails.map(e => e.id));
        const newEmails = emails.filter(e => !existingIds.has(e.id));
        return { emails: [...newEmails, ...state.emails] };
      }),
      updateEmail: (emailId, updates) => set((state) => ({
        emails: state.emails.map(e => 
          e.id === emailId ? { ...e, ...updates } : e
        )
      })),
      selectEmail: (emailId) => set({ 
        selectedEmailId: emailId,
        smartReplies: [],
        emailSummary: null,
        emailAnalysis: null
      }),
      
      setDrafts: (drafts) => set({ drafts }),
      addDraft: (draft) => set((state) => ({
        drafts: [draft, ...state.drafts]
      })),
      updateDraft: (draftId, updates) => set((state) => ({
        drafts: state.drafts.map(d => 
          d.id === draftId ? { ...d, ...updates, updatedAt: new Date() } : d
        )
      })),
      removeDraft: (draftId) => set((state) => ({
        drafts: state.drafts.filter(d => d.id !== draftId)
      })),
      
      setFolders: (folders) => set({ folders }),
      setCurrentView: (view) => set({ currentView: view, selectedEmailId: null }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      openCompose: (draft = null) => set({ 
        composeOpen: true, 
        composeDraft: draft || {
          id: crypto.randomUUID(),
          accountId: get().activeAccountId || '',
          to: [],
          subject: '',
          body: '',
          updatedAt: new Date()
        }
      }),
      closeCompose: () => set({ composeOpen: false, composeDraft: null }),
      updateComposeDraft: (updates) => set((state) => ({
        composeDraft: state.composeDraft 
          ? { ...state.composeDraft, ...updates, updatedAt: new Date() }
          : null
      })),
      
      setSmartReplies: (replies) => set({ smartReplies: replies }),
      setEmailSummary: (summary) => set({ emailSummary: summary }),
      setEmailAnalysis: (analysis) => set({ emailAnalysis: analysis }),
      
      getSelectedEmail: () => {
        const state = get();
        return state.emails.find(e => e.id === state.selectedEmailId);
      },
      getUnreadCount: () => {
        return get().emails.filter(e => !e.isRead).length;
      }
    }),
    {
      name: 'alfie-email-storage',
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        currentView: state.currentView,
      }),
    }
  )
);
