import React from "react";
import { motion } from "framer-motion";
import { Terminal, Layers, Box, Download, Palette, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/JarvisThemeContext";

export default function IntegrationGuide() {
  const { theme: _theme } = useTheme();

  const sections = [
    {
      id: "overview",
      title: "Overview",
      icon: <Terminal className="w-6 h-6 text-cyan-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-cyan-100/80 leading-relaxed">
            The <strong>RASPUTIN OS v0.3 UI Kit</strong> is a modular, drop-in
            frontend system designed to upgrade any React application with a
            cinematic, sci-fi interface. It includes a 3D holographic
            visualization engine, a multi-spectrum theme system, and a
            generative sound engine.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-black/40 border border-cyan-900/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-cyan-400 font-bold">
                <Box className="w-4 h-4" />
                <span>Visual Core</span>
              </div>
              <p className="text-xs text-cyan-100/60">
                Three.js holographic engine + Framer Motion animations.
              </p>
            </div>
            <div className="bg-black/40 border border-cyan-900/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold">
                <Palette className="w-4 h-4" />
                <span>Theme Engine</span>
              </div>
              <p className="text-xs text-cyan-100/60">
                10+ sci-fi color palettes with CSS variable architecture.
              </p>
            </div>
            <div className="bg-black/40 border border-cyan-900/30 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-green-400 font-bold">
                <Music className="w-4 h-4" />
                <span>Sonic Layer</span>
              </div>
              <p className="text-xs text-cyan-100/60">
                Generative Web Audio synthesizer for UI feedback.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "installation",
      title: "Installation",
      icon: <Download className="w-6 h-6 text-green-400" />,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-cyan-300 mb-2">
              1. Install Dependencies
            </h3>
            <div className="bg-black/80 border border-cyan-900/50 rounded p-4 font-mono text-xs text-green-400 overflow-x-auto">
              pnpm add three @react-three/fiber @react-three/drei framer-motion
              lucide-react jspdf
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-cyan-300 mb-2">
              2. Copy Asset Structure
            </h3>
            <p className="text-xs text-cyan-100/60 mb-2">
              Ensure your project structure matches the following layout for
              seamless integration:
            </p>
            <div className="bg-black/80 border border-cyan-900/50 rounded p-4 font-mono text-xs text-cyan-100/80 whitespace-pre">
              {`src/
├── components/
│   ├── HolographicConsensus.tsx  # 3D Visualization Core
│   ├── SplashScreen.tsx          # Boot Sequence
│   ├── ThemeSelector.tsx         # Theme Switcher
│   └── ui/                       # Shadcn UI Primitives
├── contexts/
│   └── ThemeContext.tsx          # Global State
├── hooks/
│   └── useVoice.ts               # ElevenLabs Integration
├── lib/
│   └── sound.ts                  # Audio Engine
└── index.css                     # CSS Variables & Tailwind`}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "integration",
      title: "Wiring It Up",
      icon: <Layers className="w-6 h-6 text-purple-400" />,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-cyan-300 mb-2">
              1. Wrap Your App
            </h3>
            <p className="text-xs text-cyan-100/60 mb-2">
              Wrap your root component with the <code>ThemeProvider</code> to
              enable the multi-spectrum engine.
            </p>
            <div className="bg-black/80 border border-cyan-900/50 rounded p-4 font-mono text-xs text-purple-300 overflow-x-auto">
              {`// App.tsx
import { ThemeProvider } from '@/contexts/JarvisThemeContext';
import SplashScreen from '@/components/SplashScreen';

export default function App() {
  return (
    <ThemeProvider>
      <SplashScreen />
      <YourMainContent />
    </ThemeProvider>
  );
}`}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-cyan-300 mb-2">
              2. Connect Real Data
            </h3>
            <p className="text-xs text-cyan-100/60 mb-2">
              The <code>Research</code> component accepts a <code>models</code>{" "}
              prop. Map your WebSocket data to this interface:
            </p>
            <div className="bg-black/80 border border-cyan-900/50 rounded p-4 font-mono text-xs text-blue-300 overflow-x-auto">
              {`interface ModelStatus {
  id: string;
  name: string;
  status: 'idle' | 'thinking' | 'streaming' | 'complete';
  tokens: number; // Live token count from backend
  latency: number; // Ping in ms
}`}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-cyan-50 font-sans selection:bg-cyan-500/30 p-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 border-b border-cyan-900/30 pb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">
            RASPUTIN OS v0.3{" "}
            <span className="text-white/20 font-mono text-lg">
              INTEGRATION MANUAL
            </span>
          </h1>
          <p className="text-xl text-cyan-100/60">
            Technical documentation for deploying the House Cartu interface
            system.
          </p>
        </div>

        <div className="grid gap-12">
          {sections.map(section => (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold text-cyan-100">
                  {section.title}
                </h2>
              </div>

              <div className="pl-16 border-l border-cyan-900/30 ml-6">
                {section.content}
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-16 p-8 bg-gradient-to-r from-cyan-900/20 to-transparent border border-cyan-500/30 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-cyan-100 mb-2">
              Ready to Deploy?
            </h3>
            <p className="text-cyan-100/60 text-sm">
              Download the complete source package including all assets and
              components.
            </p>
          </div>
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-6 h-auto text-lg shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            <Download className="mr-2 w-5 h-5" />
            DOWNLOAD UI KIT
          </Button>
        </div>
      </div>
    </div>
  );
}
