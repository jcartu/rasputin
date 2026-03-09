'use client';

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Code2,
  Globe,
  FileSearch,
  Lightbulb,
  Brain,
  Zap,
  Shield,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomeScreenProps {
  onPromptSelect: (prompt: string) => void;
  username?: string;
}

const STARTER_PROMPTS = [
  {
    icon: Code2,
    title: 'Write Code',
    description: 'Generate, debug, or refactor code in any language',
    prompt: 'Help me write a Python function that fetches data from an API and caches the results with TTL expiration',
    gradient: 'from-violet-500/20 to-purple-600/20',
    border: 'border-violet-500/30',
    iconColor: 'text-violet-400',
  },
  {
    icon: Globe,
    title: 'Research & Analyze',
    description: 'Search the web and synthesize information',
    prompt: 'Research the latest developments in AI agents and autonomous systems in 2026',
    gradient: 'from-cyan-500/20 to-blue-600/20',
    border: 'border-cyan-500/30',
    iconColor: 'text-cyan-400',
  },
  {
    icon: FileSearch,
    title: 'Analyze Documents',
    description: 'Upload and extract insights from files',
    prompt: 'I want to upload a document and have you summarize the key points and action items',
    gradient: 'from-emerald-500/20 to-green-600/20',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Lightbulb,
    title: 'Brainstorm Ideas',
    description: 'Creative problem-solving and planning',
    prompt: 'Help me brainstorm a business plan for a SaaS product that uses AI to automate customer support',
    gradient: 'from-amber-500/20 to-orange-600/20',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-400',
  },
];

const FEATURE_BADGES = [
  { icon: Brain, label: 'Claude Opus 4', color: 'text-violet-400' },
  { icon: Zap, label: 'Agent Mode', color: 'text-cyan-400' },
  { icon: Shield, label: 'Code Sandbox', color: 'text-emerald-400' },
  { icon: Layers, label: 'Multi-Model', color: 'text-amber-400' },
];

export const WelcomeScreen = memo(function WelcomeScreen({
  onPromptSelect,
  username,
}: WelcomeScreenProps) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const greeting = username ? `Welcome, ${username}` : 'Welcome to ALFIE';

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <motion.div
          animate={{
            boxShadow: [
              '0 0 20px hsl(262 83% 58% / 0.2)',
              '0 0 40px hsl(262 83% 58% / 0.4)',
              '0 0 20px hsl(262 83% 58% / 0.2)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center mb-6"
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>

        <h1 className="text-3xl font-bold gradient-text mb-2">{greeting}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your AI-powered assistant for code, research, analysis, and creative work.
          Choose a starting point or type anything below.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
        {STARTER_PROMPTS.map((item, idx) => (
          <motion.button
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + idx * 0.08 }}
            onMouseEnter={() => setHoveredCard(idx)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => onPromptSelect(item.prompt)}
            className={cn(
              'relative p-4 rounded-xl border text-left transition-all duration-200 group overflow-hidden',
              item.border,
              hoveredCard === idx
                ? 'bg-card/90 shadow-lg scale-[1.02]'
                : 'bg-card/40 hover:bg-card/70'
            )}
          >
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                item.gradient
              )}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={cn('w-5 h-5', item.iconColor)} />
                <span className="font-medium text-sm text-foreground">{item.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {FEATURE_BADGES.map((badge) => (
          <div
            key={badge.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50 text-xs text-muted-foreground"
          >
            <badge.icon className={cn('w-3.5 h-3.5', badge.color)} />
            {badge.label}
          </div>
        ))}
      </motion.div>
    </div>
  );
});
