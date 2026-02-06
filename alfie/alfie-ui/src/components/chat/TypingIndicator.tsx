'use client';

import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex gap-3 p-4"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
        <Bot className="w-5 h-5 text-foreground" />
      </div>

      <div className="flex items-center gap-1 px-4 py-3 rounded-xl bg-card border border-border">
        <motion.div
          className="w-2 h-2 rounded-full bg-primary typing-dot"
        />
        <motion.div
          className="w-2 h-2 rounded-full bg-primary typing-dot"
        />
        <motion.div
          className="w-2 h-2 rounded-full bg-primary typing-dot"
        />
      </div>
    </motion.div>
  );
}
