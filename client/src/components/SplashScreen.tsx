import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export default function SplashScreen({
  onComplete,
  duration = 3500,
}: SplashScreenProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);

  useEffect(() => {
    const textTimer = setTimeout(() => setTextVisible(true), 500);
    const taglineTimer = setTimeout(() => setTaglineVisible(true), 1500);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onComplete?.();
      }, 1000);
    }, duration);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(taglineTimer);
      clearTimeout(exitTimer);
    };
  }, [duration, onComplete]);

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.3)); }
          50% { opacity: 1; transform: scale(1.1); filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.6)); }
        }
        @keyframes glitch {
          0% { clip-path: inset(40% 0 61% 0); transform: translate(-2px, 2px); }
          20% { clip-path: inset(92% 0 1% 0); transform: translate(0); }
          40% { clip-path: inset(43% 0 1% 0); transform: translate(-2px, -2px); }
          60% { clip-path: inset(25% 0 58% 0); transform: translate(2px, 2px); }
          80% { clip-path: inset(54% 0 7% 0); transform: translate(-2px, 2px); }
          100% { clip-path: inset(58% 0 43% 0); transform: translate(0); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; }
        }
        @keyframes reveal {
          0% { opacity: 0; filter: blur(10px); letter-spacing: 1em; }
          100% { opacity: 1; filter: blur(0); letter-spacing: 0.2em; }
        }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-spin-reverse { animation: spin-reverse 15s linear infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .glitch-text::before, .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .glitch-text::before {
          left: 2px;
          text-shadow: -1px 0 #ff00c1;
          clip-path: inset(24% 0 29% 0);
          animation: glitch 2.5s infinite linear alternate-reverse;
        }
        .glitch-text::after {
          left: -2px;
          text-shadow: -1px 0 #00fff9;
          clip-path: inset(54% 0 21% 0);
          animation: glitch 2s infinite linear alternate-reverse;
        }
        .bg-grid-pattern {
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>

      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden transition-all duration-1000 ${
          isExiting ? "opacity-0 scale-105 filter blur-xl" : "opacity-100"
        }`}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-radial from-violet-900/20 via-black to-black pointer-events-none" />

        <div
          className="absolute inset-0 pointer-events-none opacity-10 z-10"
          style={{
            background:
              "linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.5) 51%)",
            backgroundSize: "100% 4px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-10 animate-[scanline_8s_linear_infinite] bg-gradient-to-b from-transparent via-white to-transparent h-full w-full" />

        <div className="relative w-96 h-96 mb-12 flex items-center justify-center">
          <div className="absolute inset-0 border border-violet-500/20 rounded-full animate-spin-slow pointer-events-none">
            <div className="absolute -top-1 left-1/2 w-2 h-2 bg-violet-500 rounded-full shadow-[0_0_10px_#8b5cf6]" />
            <div className="absolute -bottom-1 left-1/2 w-2 h-2 bg-violet-500 rounded-full shadow-[0_0_10px_#8b5cf6]" />
          </div>

          <div className="absolute inset-8 border border-cyan-500/20 rounded-full animate-spin-reverse pointer-events-none">
            <div className="absolute top-1/2 -left-1 w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
            <div className="absolute top-1/2 -right-1 w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
          </div>

          <div className="absolute inset-0 flex items-center justify-center animate-pulse-glow">
            <svg
              viewBox="0 0 200 200"
              className="w-64 h-64 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]"
            >
              <path
                d="M100 20 L150 180 L20 80 L180 80 L50 180 Z"
                fill="none"
                stroke="url(#mystic-gradient)"
                strokeWidth="1"
                className="opacity-60"
              />
              <circle
                cx="100"
                cy="100"
                r="45"
                fill="none"
                stroke="rgba(139, 92, 246, 0.3)"
                strokeWidth="1"
              />
              <circle
                cx="100"
                cy="100"
                r="5"
                fill="#fff"
                className="animate-pulse"
              />

              <defs>
                <linearGradient
                  id="mystic-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-float opacity-50"
              style={{
                top: `${50 + 30 * Math.cos((i * 60 * Math.PI) / 180)}%`,
                left: `${50 + 30 * Math.sin((i * 60 * Math.PI) / 180)}%`,
                animationDelay: `${i * 0.5}s`,
                boxShadow: "0 0 10px rgba(255,255,255,0.8)",
              }}
            />
          ))}
        </div>

        <div className="relative z-20 text-center">
          <div
            className={`transition-all duration-1000 transform ${textVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          >
            <h1
              className="text-7xl md:text-8xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-white glitch-text filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              data-text="RASPUTIN"
              style={{ fontFamily: '"Courier New", monospace' }}
            >
              RASPUTIN
            </h1>
          </div>

          <div
            className={`mt-6 transition-all duration-1000 delay-500 ${taglineVisible ? "opacity-100" : "opacity-0"}`}
          >
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-500" />
              <p className="text-cyan-400 font-mono text-sm tracking-[0.3em] uppercase animate-[flicker_4s_infinite]">
                The All-Seeing Oracle
              </p>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-cyan-500" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">
            Synthesizing Models
          </span>
        </div>

        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-1000 delay-1000 ${taglineVisible ? "opacity-100" : "opacity-0"}`}
        >
          <p className="text-[11px] text-white/20 tracking-[0.15em] font-light">
            a <span className="text-white/40 font-medium">josh cartu</span>{" "}
            project
          </p>
        </div>
      </div>
    </>
  );
}
