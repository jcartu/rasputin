import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Zap,
  Sparkles,
  ArrowRight,
  Brain,
  Globe,
  // Shield,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

export default function Home() {
  const { user: _user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              width="32"
              height="24"
              viewBox="0 0 120 80"
              className="text-primary"
            >
              <ellipse
                cx="30"
                cy="40"
                rx="20"
                ry="25"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <circle cx="30" cy="40" r="8" fill="currentColor" />
              <ellipse
                cx="90"
                cy="40"
                rx="20"
                ry="25"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <circle cx="90" cy="40" r="8" fill="currentColor" />
            </svg>
            <span className="text-xl font-bold text-primary">RASPUTIN</span>
          </div>
          <div>
            {isAuthenticated ? (
              <Button
                onClick={() => navigate("/chat")}
                className="bg-primary hover:bg-primary/90"
              >
                Open App
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => (window.location.href = getLoginUrl())}
                className="bg-primary hover:bg-primary/90"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          {/* Animated Logo */}
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <svg
              width="120"
              height="80"
              viewBox="0 0 120 80"
              className="relative"
            >
              <ellipse
                cx="30"
                cy="40"
                rx="20"
                ry="25"
                fill="none"
                stroke="oklch(0.75 0.18 195)"
                strokeWidth="2"
              />
              <circle
                cx="30"
                cy="40"
                r="8"
                fill="oklch(0.75 0.18 195)"
                className="animate-processing-pulse"
              />
              <circle cx="33" cy="37" r="3" fill="oklch(0.95 0.01 260)" />
              <ellipse
                cx="90"
                cy="40"
                rx="20"
                ry="25"
                fill="none"
                stroke="oklch(0.75 0.18 195)"
                strokeWidth="2"
              />
              <circle
                cx="90"
                cy="40"
                r="8"
                fill="oklch(0.75 0.18 195)"
                className="animate-processing-pulse"
              />
              <circle cx="93" cy="37" r="3" fill="oklch(0.95 0.01 260)" />
            </svg>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-primary rasputin-glow-text mb-6">
            RASPUTIN
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            Multi-Model Consensus & Synthesis Engine
          </p>
          <p className="text-lg text-muted-foreground/80 mb-12 max-w-3xl mx-auto">
            Query multiple frontier AI models simultaneously. Get
            consensus-driven answers or deeply synthesized insights from GPT-5,
            Claude 4.5, Gemini 3, Grok 4, and more.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Button
                size="lg"
                onClick={() => navigate("/chat")}
                className="bg-primary hover:bg-primary/90 text-lg px-8"
              >
                Launch RASPUTIN
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => (window.location.href = getLoginUrl())}
                className="bg-primary hover:bg-primary/90 text-lg px-8"
              >
                Get Started
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Consensus Mode */}
            <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Consensus Mode
                </h3>
              </div>
              <p className="text-muted-foreground">
                Query 5-8 frontier AI models in parallel. Compare responses and
                get a consensus summary with agreement percentage across all
                models.
              </p>
            </div>

            {/* Synthesis Mode */}
            <div className="p-6 rounded-2xl bg-card border border-border hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Sparkles className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Synthesis Mode
                </h3>
              </div>
              <p className="text-muted-foreground">
                Multi-stage pipeline with web search, gap detection, conflict
                resolution, and meta-synthesis for deeply comprehensive answers.
              </p>
            </div>

            {/* Real-time Streaming */}
            <div className="p-6 rounded-2xl bg-card border border-border hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Brain className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Real-time Thinking
                </h3>
              </div>
              <p className="text-muted-foreground">
                Watch every model's response stream in real-time. See the
                thinking process, latency, token counts, and costs as they
                happen.
              </p>
            </div>

            {/* Long Context */}
            <div className="p-6 rounded-2xl bg-card border border-border hover:border-green-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Globe className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Massive Context
                </h3>
              </div>
              <p className="text-muted-foreground">
                Persistent chat history with support for extremely long
                conversations. Leverage massive context windows for extended
                analysis.
              </p>
            </div>
          </div>
        </section>

        {/* Models Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Powered by Frontier Models
          </h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {[
              "GPT-5.2 Pro",
              "Claude Opus 4.5",
              "Gemini 3 Pro",
              "Grok 4.1 Pro",
              "Sonar Pro",
            ].map(model => (
              <div
                key={model}
                className="px-4 py-2 rounded-full bg-secondary border border-border text-sm text-muted-foreground"
              >
                {model}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>RASPUTIN v1.0 - Multi-Model Consensus & Synthesis Engine</p>
        </div>
      </footer>
    </div>
  );
}
