import React from 'react';
import { useTheme, Theme } from '@/contexts/JarvisThemeContext';
import { motion } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { playSound } from '@/lib/sound';

const themes: { id: Theme; name: string; color: string }[] = [
  { id: 'cyber-blue', name: 'Cyber Blue', color: '#06b6d4' },
  { id: 'code-red', name: 'Code Red', color: '#ef4444' },
  { id: 'matrix-green', name: 'Matrix Green', color: '#22c55e' },
  { id: 'void-purple', name: 'Void Purple', color: '#a855f7' },
  { id: 'solar-gold', name: 'Solar Gold', color: '#eab308' },
  { id: 'ice-white', name: 'Ice White', color: '#f8fafc' },
  { id: 'stealth-obsidian', name: 'Stealth Obsidian', color: '#171717' },
  { id: 'neon-pink', name: 'Neon Pink', color: '#ec4899' },
  { id: 'radioactive-orange', name: 'Radioactive', color: '#f97316' },
  { id: 'deep-ocean', name: 'Deep Ocean', color: '#0ea5e9' },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: Theme) => {
    playSound('hover');
    setTheme(newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative border-primary/20 hover:border-primary/50 hover:bg-primary/10">
          <Palette className="h-[1.2rem] w-[1.2rem] text-primary transition-all" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card/95 backdrop-blur border-primary/20">
        <div className="grid grid-cols-1 gap-1 p-1">
          {themes.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className="flex items-center justify-between cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                  style={{ backgroundColor: t.color, boxShadow: `0 0 8px ${t.color}` }}
                />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                  {t.name}
                </span>
              </div>
              {theme === t.id && (
                <motion.div
                  layoutId="activeTheme"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Check className="w-3 h-3 text-primary" />
                </motion.div>
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
