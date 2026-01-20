import { motion } from "framer-motion";
import { Terminal, Layers, Box, Download, Palette, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocsLayout from "@/components/DocsLayout";

export default function DocsIntegrationGuide() {
  const sections = [
    {
      id: "overview",
      title: "Overview",
      icon: <Terminal className="w-6 h-6 text-primary" />,
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            The{" "}
            <strong className="text-foreground">RASPUTIN OS v0.3 UI Kit</strong>{" "}
            is a modular, drop-in frontend system designed to upgrade any React
            application with a cinematic, sci-fi interface. It includes a 3D
            holographic visualization engine, a multi-spectrum theme system, and
            a generative sound engine.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-card/40 border border-border p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-primary font-bold">
                <Box className="w-4 h-4" />
                <span>Visual Core</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Three.js holographic engine + Framer Motion animations.
              </p>
            </div>
            <div className="bg-card/40 border border-border p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-primary font-bold">
                <Palette className="w-4 h-4" />
                <span>Theme Engine</span>
              </div>
              <p className="text-xs text-muted-foreground">
                10+ sci-fi color palettes with CSS variable architecture.
              </p>
            </div>
            <div className="bg-card/40 border border-border p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-primary font-bold">
                <Music className="w-4 h-4" />
                <span>Sonic Layer</span>
              </div>
              <p className="text-xs text-muted-foreground">
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
      icon: <Download className="w-6 h-6 text-primary" />,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">
              1. Install Dependencies
            </h3>
            <div className="bg-card border border-border rounded p-4 font-mono text-xs text-primary overflow-x-auto">
              pnpm add three @react-three/fiber @react-three/drei framer-motion
              lucide-react jspdf
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">
              2. Copy Asset Structure
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Ensure your project structure matches the following layout for
              seamless integration:
            </p>
            <div className="bg-card border border-border rounded p-4 font-mono text-xs text-muted-foreground whitespace-pre overflow-x-auto">
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
      icon: <Layers className="w-6 h-6 text-primary" />,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">
              1. Wrap Your App
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Wrap your root component with the{" "}
              <code className="text-primary">ThemeProvider</code> to enable the
              multi-spectrum engine.
            </p>
            <div className="bg-card border border-border rounded p-4 font-mono text-xs text-primary overflow-x-auto">
              {`// App.tsx
import { ThemeProvider } from '@/contexts/ThemeContext';
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
            <h3 className="text-sm font-bold text-foreground mb-2">
              2. Connect Real Data
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              The <code className="text-primary">Research</code> component
              accepts a <code className="text-primary">models</code> prop. Map
              your WebSocket data to this interface:
            </p>
            <div className="bg-card border border-border rounded p-4 font-mono text-xs text-primary overflow-x-auto">
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
    <DocsLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 border-b border-border pb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 mb-4">
            RASPUTIN OS v0.3{" "}
            <span className="text-muted-foreground font-mono text-lg">
              INTEGRATION MANUAL
            </span>
          </h1>
          <p className="text-xl text-muted-foreground">
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
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {section.title}
                </h2>
              </div>

              <div className="pl-16 border-l border-border ml-6">
                {section.content}
              </div>
            </motion.section>
          ))}
        </div>

        <div className="mt-16 p-8 bg-gradient-to-r from-primary/10 to-transparent border border-primary/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Ready to Deploy?
            </h3>
            <p className="text-muted-foreground text-sm">
              Download the complete source package including all assets and
              components.
            </p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-6 h-auto text-lg shadow-[0_0_20px_var(--primary)]">
            <Download className="mr-2 w-5 h-5" />
            DOWNLOAD UI KIT
          </Button>
        </div>
      </div>
    </DocsLayout>
  );
}
