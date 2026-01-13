import { createContext, useContext, type ReactNode } from "react";
import { useVoiceAnnouncement } from "@/hooks/useVoiceAnnouncement";

interface VoiceAnnouncementContextType {
  isEnabled: boolean;
  isSpeaking: boolean;
  toggle: () => void;
  stop: () => void;
  setEnabled: (enabled: boolean) => void;
}

const VoiceAnnouncementContext =
  createContext<VoiceAnnouncementContextType | null>(null);

export function VoiceAnnouncementProvider({
  children,
}: {
  children: ReactNode;
}) {
  const voice = useVoiceAnnouncement();

  return (
    <VoiceAnnouncementContext.Provider value={voice}>
      {children}
    </VoiceAnnouncementContext.Provider>
  );
}

export function useVoiceAnnouncementContext() {
  const context = useContext(VoiceAnnouncementContext);
  if (!context) {
    throw new Error(
      "useVoiceAnnouncementContext must be used within VoiceAnnouncementProvider"
    );
  }
  return context;
}
