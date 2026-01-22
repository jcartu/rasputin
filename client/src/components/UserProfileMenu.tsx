import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { LogOut, ChevronDown, Volume2, VolumeX } from "lucide-react";
import { useVoiceAnnouncementContext } from "@/contexts/VoiceAnnouncementContext";

export function UserProfileMenu() {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const logoutMutation = trpc.auth.logout.useMutation();
  const { isEnabled: voiceEnabled, toggle: toggleVoice } =
    useVoiceAnnouncementContext();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading || !user) {
    return null;
  }

  // Get user's initials for fallback avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user has a Google avatar (stored in avatarUrl or picture field)
  const avatarUrl =
    (user as unknown as { avatarUrl?: string; picture?: string }).avatarUrl ||
    (user as unknown as { avatarUrl?: string; picture?: string }).picture ||
    null;
  const displayName = user.name || "User";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full border-2 border-primary/50"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center text-primary text-sm font-medium">
            {getInitials(displayName)}
          </div>
        )}

        {/* Name (hidden on mobile) */}
        <span className="hidden md:block text-sm text-foreground/80 max-w-[120px] truncate">
          {displayName}
        </span>

        {/* Dropdown arrow */}
        <ChevronDown
          className={`w-4 h-4 text-foreground/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border-2 border-primary/50"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center text-primary font-medium">
                  {getInitials(displayName)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </p>
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={toggleVoice}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted transition-colors"
            >
              {voiceEnabled ? (
                <Volume2 className="w-4 h-4 text-primary" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
              Voice Announcements
              <span
                className={`ml-auto text-xs px-1.5 py-0.5 rounded ${voiceEnabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {voiceEnabled ? "ON" : "OFF"}
              </span>
            </button>
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
