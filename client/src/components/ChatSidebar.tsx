import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Loader2,
  Zap,
  Sparkles,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  Download,
  FileText,
} from "lucide-react";

interface ChatSidebarProps {
  currentChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
}

export function ChatSidebar({
  currentChatId,
  onSelectChat,
  onNewChat,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [_deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: chats, isLoading } = trpc.chats.list.useQuery({});
  const deleteChatMutation = trpc.chats.delete.useMutation({
    onSuccess: () => {
      utils.chats.list.invalidate();
    },
  });
  const updateChatMutation = trpc.chats.update.useMutation({
    onSuccess: () => {
      utils.chats.list.invalidate();
    },
  });

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Filter chats by search query
  const filteredChats = useMemo(() => {
    if (!chats) return [];
    if (!searchQuery.trim()) return chats;

    const query = searchQuery.toLowerCase();
    return chats.filter(chat => chat.title.toLowerCase().includes(query));
  }, [chats, searchQuery]);

  // Group chats by date
  const groupedChats = useMemo(() => {
    const groups: { label: string; chats: typeof filteredChats }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayChats: typeof filteredChats = [];
    const yesterdayChats: typeof filteredChats = [];
    const lastWeekChats: typeof filteredChats = [];
    const olderChats: typeof filteredChats = [];

    for (const chat of filteredChats) {
      const chatDate = new Date(chat.updatedAt);
      if (chatDate >= today) {
        todayChats.push(chat);
      } else if (chatDate >= yesterday) {
        yesterdayChats.push(chat);
      } else if (chatDate >= lastWeek) {
        lastWeekChats.push(chat);
      } else {
        olderChats.push(chat);
      }
    }

    if (todayChats.length > 0)
      groups.push({ label: "Today", chats: todayChats });
    if (yesterdayChats.length > 0)
      groups.push({ label: "Yesterday", chats: yesterdayChats });
    if (lastWeekChats.length > 0)
      groups.push({ label: "Last 7 Days", chats: lastWeekChats });
    if (olderChats.length > 0)
      groups.push({ label: "Older", chats: olderChats });

    return groups;
  }, [filteredChats]);

  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(chatId);
    try {
      await deleteChatMutation.mutateAsync({ chatId });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartEdit = (
    chatId: number,
    currentTitle: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setEditingId(chatId);
    setEditTitle(currentTitle);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle("");
  };

  const handleSaveEdit = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateChatMutation.mutateAsync({
        chatId,
        title: editTitle.trim(),
      });
    } finally {
      setEditingId(null);
      setEditTitle("");
    }
  };

  const handleEditKeyDown = (chatId: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit(chatId, e as any);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditTitle("");
    }
  };

  const handleExportMarkdown = async (chatId: number) => {
    setExportingId(chatId);
    try {
      const result = await utils.chats.exportMarkdown.fetch({ chatId });
      // Create and download file
      const blob = new Blob([result.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export:", error);
    } finally {
      setExportingId(null);
    }
  };

  const handleExportPDF = async (chatId: number) => {
    setExportingId(chatId);
    try {
      const result = await utils.chats.exportMarkdown.fetch({ chatId });
      // For PDF, we'll create a simple HTML version and use print
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${result.filename.replace(".md", "")}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
            h1 { color: #00d9c0; border-bottom: 2px solid #00d9c0; padding-bottom: 10px; }
            hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
            strong { color: #333; }
            em { color: #666; font-size: 0.9em; }
            pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
            code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          ${result.markdown
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/---/g, "<hr>")
            .replace(/\n\n/g, "</p><p>")
            .replace(/```([\\s\\S]*?)```/g, "<pre><code>$1</code></pre>")}
        </body>
        </html>
      `;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setExportingId(null);
    }
  };

  const getModeIcon = (mode: string) => {
    return mode === "synthesis" ? (
      <Sparkles className="h-3 w-3 text-purple-400" />
    ) : (
      <Zap className="h-3 w-3 text-primary" />
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNewChat}
          className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : groupedChats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs mt-1">Start a new conversation</p>
            </div>
          ) : (
            groupedChats.map(group => (
              <div key={group.label} className="mb-4">
                <h3 className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">
                  {group.label}
                </h3>
                <div className="space-y-1">
                  {group.chats.map(chat => (
                    <div
                      key={chat.id}
                      onClick={() =>
                        editingId !== chat.id && onSelectChat(chat.id)
                      }
                      className={`
                        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                        transition-colors duration-150
                        ${
                          currentChatId === chat.id
                            ? "bg-primary/20 border border-primary/30"
                            : "hover:bg-secondary border border-transparent"
                        }
                      `}
                    >
                      <div className="flex-shrink-0">
                        {getModeIcon(chat.mode)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === chat.id ? (
                          <Input
                            ref={editInputRef}
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={e => handleEditKeyDown(chat.id, e)}
                            onClick={e => e.stopPropagation()}
                            className="h-6 text-sm py-0 px-1 bg-secondary"
                          />
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate text-foreground">
                              {chat.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {chat.messageCount} messages
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingId === chat.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={e => handleSaveEdit(chat.id, e)}
                              disabled={updateChatMutation.isPending}
                            >
                              {updateChatMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 text-green-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {exportingId === chat.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleStartEdit(
                                      chat.id,
                                      chat.title,
                                      e as any
                                    );
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleExportMarkdown(chat.id);
                                  }}
                                >
                                  <FileText className="h-3 w-3 mr-2" />
                                  Export Markdown
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleExportPDF(chat.id);
                                  }}
                                >
                                  <Download className="h-3 w-3 mr-2" />
                                  Export PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleDeleteChat(chat.id, e as any);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          RASPUTIN v1.0
        </p>
      </div>
    </div>
  );
}
