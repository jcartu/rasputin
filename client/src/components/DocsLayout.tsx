import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal,
  Cpu,
  Network,
  Database,
  Shield,
  Zap,
  Download,
  Menu,
  X,
  ChevronRight,
  Activity,
  BookOpen,
} from "lucide-react";
import DocsThemeSelector from "@/components/docs/DocsThemeSelector";

interface DocsLayoutProps {
  children: React.ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { href: "/docs", label: "Executive Summary", icon: Terminal },
    { href: "/docs/architecture", label: "System Architecture", icon: Network },
    { href: "/docs/agents", label: "Swarm Agents", icon: Cpu },
    { href: "/docs/memory", label: "Memory Systems", icon: Database },
    { href: "/docs/daemon", label: "Desktop Daemon", icon: Zap },
    { href: "/docs/security", label: "Security & Safety", icon: Shield },
    { href: "/docs/implementation", label: "Roadmap", icon: Activity },
    { href: "/docs/integration", label: "Integration Guide", icon: BookOpen },
    { href: "/docs/ingestion", label: "Ingestion Hub", icon: Download },
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

      <header className="lg:hidden sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <div className="ml-4 font-mono font-bold text-primary tracking-wider">
            JARVIS v3
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 transform border-r border-border bg-background/95 backdrop-blur transition-transform duration-300 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center justify-between border-b border-border px-6">
              <div className="flex items-center">
                <Terminal className="mr-2 h-6 w-6 text-primary" />
                <span className="font-mono font-bold text-lg tracking-wider text-primary">
                  JARVIS v3
                </span>
              </div>
              <DocsThemeSelector />
            </div>
            <ScrollArea className="flex-1 py-4">
              <nav className="space-y-1 px-2">
                {navItems.map(item => {
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors font-mono",
                        isActive
                          ? "bg-primary/10 text-primary border-r-2 border-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {item.label}
                      {isActive && (
                        <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </ScrollArea>
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                SYSTEM ONLINE
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 relative z-10">
          <div className="container py-8 lg:py-10 max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
