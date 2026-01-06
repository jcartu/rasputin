import { useEffect, useState } from "react";

export function SplashScreen() {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`
        fixed inset-0 z-50 bg-background
        flex flex-col items-center justify-center
        transition-opacity duration-700
        ${fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
    >
      {/* Radial glow background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-[800px] h-[800px] rounded-full
                     bg-gradient-radial from-cyan-500/30 via-cyan-500/10 to-transparent
                     animate-radial-glow"
        />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Hexagon Cluster Logo - 5 AI Models Converging */}
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Glow filter */}
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient
                id="hexGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
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
                  {/* Inner glow */}
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
              {/* Central eye */}
              <circle
                cx="100"
                cy="100"
                r="15"
                fill="oklch(0.75 0.18 195)"
                className="animate-processing-pulse"
              />
              <circle cx="100" cy="100" r="8" fill="oklch(0.15 0.01 260)" />
              <circle cx="104" cy="96" r="3" fill="oklch(0.95 0.01 260)" />
            </g>

            {/* Connection lines from outer hexagons to center */}
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
                  className="animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              );
            })}
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 rasputin-glow-text">
          RASPUTIN
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground text-lg tracking-wide text-center max-w-md">
          Multi-Model Consensus & Synthesis Engine
        </p>

        {/* Loading indicator - 5 dots for 5 models */}
        <div className="flex gap-3 mt-4">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        {/* Status text */}
        <p className="text-cyan-500/60 text-sm animate-pulse">
          Initializing AI models...
        </p>
      </div>

      {/* Floating hexagon particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 4) * 20}%`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon
                points="6,0 11.2,3 11.2,9 6,12 0.8,9 0.8,3"
                fill="oklch(0.75 0.18 195 / 0.3)"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to generate hexagon points
function hexagonPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 30) * (Math.PI / 180);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}
