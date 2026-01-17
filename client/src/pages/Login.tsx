import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Eye, EyeOff, Zap } from "lucide-react";

function HexagonLogo() {
  const hexagonPoints = (cx: number, cy: number, r: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 30) * (Math.PI / 180);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(" ");
  };

  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="coreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3, 4].map(i => {
        const angle = (i * 72 - 90) * (Math.PI / 180);
        const cx = 100 + Math.cos(angle) * 60;
        const cy = 100 + Math.sin(angle) * 60;
        return (
          <g key={i} filter="url(#glow)">
            <polygon
              points={hexagonPoints(cx, cy, 28)}
              fill="none"
              stroke="url(#hexGradient)"
              strokeWidth="2"
              className="animate-pulse"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: "2s",
              }}
            />
            <polygon
              points={hexagonPoints(cx, cy, 18)}
              fill="rgba(168, 85, 247, 0.1)"
              className="animate-pulse"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: "2s",
              }}
            />
          </g>
        );
      })}

      <g filter="url(#glow)">
        <polygon
          points={hexagonPoints(100, 100, 40)}
          fill="rgba(34, 211, 238, 0.15)"
          stroke="url(#coreGradient)"
          strokeWidth="3"
        />
        <circle
          cx="100"
          cy="100"
          r="20"
          fill="url(#coreGradient)"
          className="animate-pulse"
          style={{ animationDuration: "1.5s" }}
        />
        <circle cx="100" cy="100" r="10" fill="#0a0a0f" />
        <circle cx="105" cy="95" r="4" fill="rgba(255,255,255,0.8)" />
      </g>

      {[0, 1, 2, 3, 4].map(i => {
        const angle = (i * 72 - 90) * (Math.PI / 180);
        const x1 = 100 + Math.cos(angle) * 60;
        const y1 = 100 + Math.sin(angle) * 60;
        return (
          <line
            key={`line-${i}`}
            x1={x1}
            y1={y1}
            x2="100"
            y2="100"
            stroke="url(#hexGradient)"
            strokeWidth="1"
            strokeDasharray="6 4"
            opacity="0.5"
          />
        );
      })}
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { loading: authLoading, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setIsLoading(false);
        return;
      }

      await refresh();
      setLocation(data.redirect || "/agent");
    } catch {
      setError("Connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-radial from-cyan-500/5 via-transparent to-transparent" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center space-y-6">
            <HexagonLogo />
            <div className="space-y-2 text-center">
              <h1 className="text-5xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400">
                RASPUTIN
              </h1>
              <p className="text-sm text-gray-500 tracking-widest uppercase">
                Autonomous AI Agent System
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-lg px-4 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-lg px-4 pr-12 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 hover:from-cyan-400 hover:via-purple-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  Initialize Session
                </>
              )}
            </Button>
          </form>

          <div className="grid grid-cols-3 gap-4 pt-6">
            <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="text-2xl mb-1">🤖</div>
              <p className="text-xs text-gray-500">AI Agent</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="text-2xl mb-1">🧠</div>
              <p className="text-xs text-gray-500">Multi-Model AI</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="text-2xl mb-1">⚡</div>
              <p className="text-xs text-gray-500">Real-time</p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 pt-4">
            Powered by Claude, GPT-4, Gemini, Grok & Sonar
          </p>
        </div>
      </div>
    </div>
  );
}
