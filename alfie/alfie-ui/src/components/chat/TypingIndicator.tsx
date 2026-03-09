'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Brain, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  phase?: 'thinking' | 'streaming';
}

const phaseConfig = {
  thinking: {
    icon: Brain,
    text: 'Analyzing your request',
    color: 'text-amber-500',
    bgPulse: 'bg-amber-500/10',
  },
  streaming: {
    icon: Pencil,
    text: 'Writing response',
    color: 'text-primary',
    bgPulse: 'bg-primary/10',
  },
};

export function TypingIndicator({ phase = 'thinking' }: TypingIndicatorProps) {
  const config = phaseConfig[phase];
  const PhaseIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex gap-3 p-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-card via-card to-muted border border-border/50 shadow-lg shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
      >
        <Bot className="w-5 h-5 text-foreground" />
      </motion.div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl p-4 max-w-[85%] bg-card/90 border border-border/50 backdrop-blur-sm shadow-md overflow-hidden relative"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <PhaseIcon className={cn('w-4 h-4', config.color)} />
              </motion.div>
              <span className="text-sm text-muted-foreground">
                {config.text}
                <AnimatedEllipsis />
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
              <motion.div
                className={cn('h-full w-1/3 rounded-full', phase === 'thinking' ? 'bg-amber-500/60' : 'bg-primary/60')}
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AnimatedEllipsis() {
  return (
    <span className="inline-flex w-6 ml-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          className="text-muted-foreground"
        >
          .
        </motion.span>
      ))}
    </span>
  );
}
