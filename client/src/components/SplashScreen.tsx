import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Cpu, Zap, Shield, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'bios' | 'glitch' | 'logo' | 'complete'>('bios');
  const [lines, setLines] = useState<string[]>([]);

  // BIOS Sequence
  useEffect(() => {
    const bootLines = [
      "BIOS DATE 01/18/26 14:22:55 VER 3.0.0",
      "CPU: NEURAL QUANTUM CORE i9-14900K @ 6.2GHz",
      "RAM: 96GB DDR5 8000MHz [OK]",
      "GPU: NVIDIA H100 NVL [LINK ESTABLISHED]",
      "DETECTING NEURAL INTERFACES...",
      "> GPT-5.2 PRO [CONNECTED]",
      "> CLAUDE OPUS 4.5 [CONNECTED]",
      "> GEMINI 3.0 PRO [CONNECTED]",
      "LOADING KERNEL MODULES...",
      "MOUNTING VIRTUAL FILE SYSTEM...",
      "INITIALIZING SWARM PROTOCOLS...",
      "SYSTEM CHECK: PASSED",
      "BOOTING RASPUTIN OS..."
    ];

    let lineIndex = 0;
    const interval = setInterval(() => {
      if (lineIndex < bootLines.length) {
        setLines(prev => [...prev, bootLines[lineIndex]]);
        playSound('type');
        lineIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => setStep('glitch'), 500);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Glitch & Logo Sequence
  useEffect(() => {
    if (step === 'glitch') {
      playSound('scan');
      setTimeout(() => setStep('logo'), 1500);
    }
    if (step === 'logo') {
      playSound('success');
      setTimeout(() => {
        setStep('complete');
        setTimeout(onComplete, 1000); // Fade out time
      }, 3000);
    }
  }, [step, onComplete]);

  return (
    <AnimatePresence>
      {step !== 'complete' && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden font-mono"
          exit={{ opacity: 0, filter: 'blur(20px)' }}
          transition={{ duration: 1 }}
        >
          {/* BIOS Mode */}
          {step === 'bios' && (
            <div className="w-full max-w-3xl p-8 text-cyan-500 text-sm md:text-base">
              <div className="mb-4 flex items-center gap-2 text-cyan-300 border-b border-cyan-900/50 pb-2">
                <Terminal className="w-5 h-5" />
                <span>RASPUTIN_BOOT_LOADER_v3.0</span>
              </div>
              <div className="space-y-1">
                {lines.map((line, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2"
                  >
                    <span className="text-cyan-700">[{new Date().toLocaleTimeString()}]</span>
                    <span>{line}</span>
                  </motion.div>
                ))}
                <motion.div 
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-3 h-5 bg-cyan-500 inline-block ml-1"
                />
              </div>
            </div>
          )}

          {/* Glitch Mode */}
          {step === 'glitch' && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Random Glitch Rectangles */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute bg-cyan-500/20"
                  initial={{ 
                    left: `${Math.random() * 100}%`, 
                    top: `${Math.random() * 100}%`,
                    width: Math.random() * 200,
                    height: Math.random() * 50,
                    opacity: 0
                  }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    x: [0, (Math.random() - 0.5) * 100],
                    scaleX: [1, 5, 1]
                  }}
                  transition={{ duration: 0.2, delay: Math.random() * 1 }}
                />
              ))}
              
              <motion.div
                className="text-6xl md:text-9xl font-black text-cyan-500 tracking-tighter"
                animate={{ 
                  x: [-5, 5, -5, 0],
                  skewX: [-20, 20, -10, 0],
                  opacity: [0.5, 1, 0.5, 1]
                }}
                transition={{ duration: 0.2, repeat: 5 }}
              >
                SYSTEM BREACH
              </motion.div>
            </div>
          )}

          {/* Logo Mode */}
          {step === 'logo' && (
            <motion.div 
              className="flex flex-col items-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <div className="relative mb-8">
                <motion.div
                  className="absolute inset-0 bg-cyan-500 blur-[100px] opacity-20"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <Cpu className="w-32 h-32 text-cyan-400" />
              </div>

              <motion.h1 
                className="text-5xl md:text-7xl font-black text-white tracking-[0.2em] mb-4 text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                RASPUTIN <span className="text-cyan-500">OS</span>
              </motion.h1>

              <motion.div 
                className="flex items-center gap-4 text-cyan-600 font-mono tracking-widest text-sm md:text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span className="w-12 h-[1px] bg-cyan-800" />
                v0.3.0 // A HOUSE CARTU PROJECT
                <span className="w-12 h-[1px] bg-cyan-800" />
              </motion.div>

              <motion.div
                className="mt-12 flex gap-8 text-cyan-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Zap className="w-6 h-6" />
                  <span className="text-[10px] tracking-widest">HYBRID CORE</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Shield className="w-6 h-6" />
                  <span className="text-[10px] tracking-widest">SECURE</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Database className="w-6 h-6" />
                  <span className="text-[10px] tracking-widest">QUANTUM MEMORY</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
