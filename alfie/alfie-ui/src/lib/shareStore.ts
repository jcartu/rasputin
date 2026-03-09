import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Message, ToolCall } from "@/lib/store";

export interface SharedConversation {
  token: string;
  sessionId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  expiresAt?: Date;
  isPublic: boolean;
}

interface ShareStoreState {
  shares: SharedConversation[];
  createShare: (
    sessionId: string,
    title: string,
    messages: Message[],
    options?: { isPublic?: boolean; expiresAt?: Date }
  ) => string;
  getShare: (token: string) => SharedConversation | null;
  deleteShare: (token: string) => void;
}

const buildShareUrl = (token: string) => {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  return `${baseUrl}/share/${token}`;
};

const normalizeToolCall = (toolCall: ToolCall): ToolCall => ({
  ...toolCall,
  startTime: toolCall.startTime ? new Date(toolCall.startTime) : undefined,
  endTime: toolCall.endTime ? new Date(toolCall.endTime) : undefined,
});

const normalizeMessage = (message: Message): Message => ({
  ...message,
  timestamp: new Date(message.timestamp),
  toolCalls: message.toolCalls
    ? message.toolCalls.map(toolCall => normalizeToolCall(toolCall))
    : undefined,
});

const normalizeShare = (share: SharedConversation): SharedConversation => ({
  ...share,
  createdAt: new Date(share.createdAt),
  expiresAt: share.expiresAt ? new Date(share.expiresAt) : undefined,
  messages: share.messages.map(message => normalizeMessage(message)),
});

export const useShareStore = create<ShareStoreState>()(
  persist(
    (set, get) => ({
      shares: [],
      createShare: (sessionId, title, messages, options) => {
        const token = crypto.randomUUID().slice(0, 8);
        const createdAt = new Date();
        const share: SharedConversation = {
          token,
          sessionId,
          title,
          messages,
          createdAt,
          expiresAt: options?.expiresAt,
          isPublic: options?.isPublic ?? true,
        };

        set(state => ({
          shares: [share, ...state.shares],
        }));

        return buildShareUrl(token);
      },
      getShare: token => {
        const share = get().shares.find(item => item.token === token);
        return share ? normalizeShare(share) : null;
      },
      deleteShare: token => {
        set(state => ({
          shares: state.shares.filter(share => share.token !== token),
        }));
      },
    }),
    {
      name: "alfie-share-storage",
      partialize: state => ({
        shares: state.shares,
      }),
      onRehydrateStorage: () => state => {
        if (!state) return;
        state.shares = state.shares.map(share => normalizeShare(share));
      },
    }
  )
);

export const shareHelpers = {
  buildShareUrl,
  buildEmbedCode: (token: string, options?: { width?: string; height?: string }) => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    const width = options?.width ?? "100%";
    const height = options?.height ?? "600";
    return `<iframe src="${baseUrl}/embed/${token}" width="${width}" height="${height}" frameborder="0"></iframe>`;
  },
};
