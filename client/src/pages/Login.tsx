import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

// Google logo SVG component
function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9.003 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Hexagon cluster logo component
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
    <svg viewBox="0 0 200 200" className="w-32 h-32">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.75 0.18 195)" />
          <stop offset="100%" stopColor="oklch(0.65 0.15 220)" />
        </linearGradient>
      </defs>

      {/* Outer hexagons - 5 AI models */}
      {[0, 1, 2, 3, 4].map(i => {
        const angle = (i * 72 - 90) * (Math.PI / 180);
        const cx = 100 + Math.cos(angle) * 55;
        const cy = 100 + Math.sin(angle) * 55;
        return (
          <g key={i} filter="url(#glow)">
            <polygon
              points={hexagonPoints(cx, cy, 28)}
              fill="none"
              stroke="url(#hexGradient)"
              strokeWidth="2"
              className="animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
            <polygon
              points={hexagonPoints(cx, cy, 20)}
              fill="oklch(0.75 0.18 195 / 0.15)"
              className="animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          </g>
        );
      })}

      {/* Center hexagon - The Eye of Truth */}
      <g filter="url(#glow)">
        <polygon
          points={hexagonPoints(100, 100, 35)}
          fill="oklch(0.75 0.18 195 / 0.3)"
          stroke="oklch(0.85 0.2 195)"
          strokeWidth="3"
        />
        <circle
          cx="100"
          cy="100"
          r="15"
          fill="oklch(0.75 0.18 195)"
          className="animate-pulse"
        />
        <circle cx="100" cy="100" r="8" fill="oklch(0.15 0.01 260)" />
        <circle cx="104" cy="96" r="3" fill="oklch(0.95 0.01 260)" />
      </g>

      {/* Connection lines */}
      {[0, 1, 2, 3, 4].map(i => {
        const angle = (i * 72 - 90) * (Math.PI / 180);
        const x1 = 100 + Math.cos(angle) * 55;
        const y1 = 100 + Math.sin(angle) * 55;
        return (
          <line
            key={`line-${i}`}
            x1={x1}
            y1={y1}
            x2="100"
            y2="100"
            stroke="oklch(0.75 0.18 195 / 0.4)"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        );
      })}
    </svg>
  );
}

export default function Login() {
  const [, _setLocation] = useLocation();
  const { user: _user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Check for error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You cancelled the sign-in process.",
        invalid_request: "Invalid authentication request.",
        invalid_state: "Session expired. Please try again.",
        token_exchange_failed: "Failed to complete authentication.",
        userinfo_failed: "Failed to get your profile information.",
        auth_failed: "Authentication failed. Please try again.",
      };
      setError(
        errorMessages[errorParam] || "An error occurred during sign-in."
      );
    }
  }, []);

  const handleGoogleSignIn = () => {
    window.location.href = "/api/auth/google";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-cyan-500/20 via-cyan-500/5 to-transparent" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and title */}
          <div className="flex flex-col items-center space-y-4">
            <HexagonLogo />
            <h1 className="text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500">
              RASPUTIN
            </h1>
            <p className="text-muted-foreground text-center">
              Multi-Model Consensus & Synthesis Engine
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Sign in with Google - Single option */}
          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full h-14 bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-medium text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <GoogleLogo />
              <span className="ml-3">Continue with Google</span>
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="font-medium text-sm">5 AI Models</h3>
              <p className="text-xs text-muted-foreground">
                GPT-5, Claude, Gemini, Grok, Sonar
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-medium text-sm">Real-time</h3>
              <p className="text-xs text-muted-foreground">
                Live streaming responses
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-medium text-sm">Consensus</h3>
              <p className="text-xs text-muted-foreground">
                Agreement analysis
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-2xl mb-2">🔬</div>
              <h3 className="font-medium text-sm">Synthesis</h3>
              <p className="text-xs text-muted-foreground">
                Deep research pipeline
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground pt-4">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
