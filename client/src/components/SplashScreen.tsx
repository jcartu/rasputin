import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

const BOOT_LOGS = [
  "INITIALIZING KERNEL v0.3...",
  "LOADING NEURAL ENGINE...",
  "BYPASSING SECURITY PROTOCOLS...",
  "ESTABLISHING UPLINK...",
  "SYNCHRONIZING DATABASES...",
  "OPTIMIZING CORE THREADS...",
  "SYSTEM CHECK: PASSED.",
  "RASPUTIN OS READY.",
];

export default function SplashScreen({
  onComplete,
  duration = 5000,
}: SplashScreenProps) {
  const [bootStep, setBootStep] = useState(0);
  const [showMain, setShowMain] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sound Synthesis Logic
  const playBootSound = () => {
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const now = ctx.currentTime;

      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0.4, now);

      // 1. Cinematic Bass Swell
      const oscBass = ctx.createOscillator();
      const gainBass = ctx.createGain();
      oscBass.type = "sawtooth";
      oscBass.frequency.setValueAtTime(50, now);
      oscBass.frequency.exponentialRampToValueAtTime(35, now + 3);

      gainBass.gain.setValueAtTime(0, now);
      gainBass.gain.linearRampToValueAtTime(0.6, now + 1);
      gainBass.gain.exponentialRampToValueAtTime(0.001, now + 4);

      const filterBass = ctx.createBiquadFilter();
      filterBass.type = "lowpass";
      filterBass.frequency.setValueAtTime(100, now);
      filterBass.frequency.linearRampToValueAtTime(300, now + 2);

      oscBass.connect(filterBass);
      filterBass.connect(gainBass);
      gainBass.connect(masterGain);
      oscBass.start(now);
      oscBass.stop(now + 4.5);

      // 2. High-Tech Computer Data/Arp
      const oscData = ctx.createOscillator();
      const gainData = ctx.createGain();
      oscData.type = "square";
      gainData.gain.setValueAtTime(0, now);

      const bleepCount = 12;
      for (let i = 0; i < bleepCount; i++) {
        const time = now + 0.5 + i * 0.15;
        oscData.frequency.setValueAtTime(800 + Math.random() * 1000, time);
        gainData.gain.setValueAtTime(0.05, time);
        gainData.gain.setValueAtTime(0, time + 0.05);
      }

      oscData.connect(gainData);
      gainData.connect(masterGain);
      oscData.start(now);
      oscData.stop(now + 3);

      // 3. Futuristic Power Up Sweep
      const oscSweep = ctx.createOscillator();
      const gainSweep = ctx.createGain();
      oscSweep.type = "sine";
      oscSweep.frequency.setValueAtTime(200, now + 2);
      oscSweep.frequency.exponentialRampToValueAtTime(2000, now + 3.5);

      gainSweep.gain.setValueAtTime(0, now + 2);
      gainSweep.gain.linearRampToValueAtTime(0.2, now + 3);
      gainSweep.gain.linearRampToValueAtTime(0, now + 4);

      oscSweep.connect(gainSweep);
      gainSweep.connect(masterGain);
      oscSweep.start(now);
      oscSweep.stop(now + 4.5);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    playBootSound();

    let step = 0;
    const interval = setInterval(() => {
      if (step < BOOT_LOGS.length - 1) {
        setBootStep(prev => prev + 1);
        step++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowMain(true), 800);
      }
    }, 250);

    const totalTimer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(totalTimer);
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, [duration, onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col items-center justify-center overflow-hidden font-mono text-white select-none cursor-wait">
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
               linear-gradient(to right, rgba(0, 255, 170, 0.05) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(0, 255, 170, 0.05) 1px, transparent 1px)
             `,
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(circle at center, black 30%, transparent 80%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-[10%] animate-scanline" />
      </div>

      <AnimatePresence mode="wait">
        {!showMain ? (
          <motion.div
            key="boot-sequence"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
            className="z-10 w-full max-w-lg p-8 font-mono text-sm tracking-wider"
          >
            {BOOT_LOGS.slice(0, bootStep + 1).map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`${
                  i === BOOT_LOGS.length - 1
                    ? "text-emerald-400 font-bold"
                    : "text-emerald-600/80"
                } mb-1 flex items-center gap-3`}
              >
                <span className="text-[10px] opacity-50">
                  {`00${i + 1}`.slice(-2)}
                </span>
                <span>{log}</span>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="main-logo"
            initial={{ scale: 0.8, opacity: 0, filter: "blur(20px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 50 }}
            className="z-20 flex flex-col items-center relative"
          >
            <div className="absolute -inset-20 bg-emerald-500/20 blur-[100px] rounded-full animate-pulse" />

            <div className="relative flex flex-col items-center">
              <motion.h1
                className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-2"
                style={{ textShadow: "0 0 30px rgba(16, 185, 129, 0.6)" }}
              >
                RASPUTIN
                <span className="text-emerald-500 ml-2">OS</span>
              </motion.h1>

              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent w-full my-4"
              />

              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-3"
              >
                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs font-bold tracking-widest">
                  v0.3
                </span>
                <span className="text-neutral-500 text-xs tracking-[0.2em] uppercase">
                  System Online
                </span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute -bottom-24 text-neutral-600 text-[10px] tracking-[0.4em] font-medium uppercase"
              >
                A Josh Cartu Project
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] bg-repeat" />
      <div className="absolute inset-0 pointer-events-none z-[51] shadow-[inset_0_0_100px_rgba(0,0,0,0.7)]" />
    </div>
  );
}
