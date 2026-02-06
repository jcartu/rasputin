'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shortcut,
  formatShortcut,
  groupShortcutsByCategory,
  CATEGORY_LABELS,
} from '@/lib/shortcuts';
import { cn } from '@/lib/utils';

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
}

export function ShortcutsHelp({ open, onOpenChange, shortcuts }: ShortcutsHelpProps) {
  const groupedShortcuts = groupShortcutsByCategory(shortcuts);
  const categories = ['actions', 'navigation', 'modals', 'general'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Navigate and control ALFIE with your keyboard
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-6 space-y-6">
            <AnimatePresence mode="wait">
              {categories.map((category, categoryIndex) => {
                const categoryShortcuts = groupedShortcuts[category];
                if (!categoryShortcuts?.length) return null;

                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.05 }}
                    className="space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABELS[category] || category}
                    </h3>
                    <div className="space-y-1">
                      {categoryShortcuts.map((shortcut, index) => (
                        <motion.div
                          key={shortcut.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: categoryIndex * 0.05 + index * 0.02 }}
                        >
                          <ShortcutRow shortcut={shortcut} />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 mx-1 rounded bg-muted font-mono text-[10px]">Esc</kbd> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShortcutRowProps {
  shortcut: Shortcut;
}

function ShortcutRow({ shortcut }: ShortcutRowProps) {
  const formattedKeys = formatShortcut(shortcut);

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 px-3 rounded-lg',
        'hover:bg-muted/50 transition-colors',
        shortcut.enabled === false && 'opacity-50'
      )}
    >
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.modifiers.length > 0 || shortcut.key ? (
          <KeyCombo keys={formattedKeys} />
        ) : null}
      </div>
    </div>
  );
}

interface KeyComboProps {
  keys: string;
}

function KeyCombo({ keys }: KeyComboProps) {
  return (
    <div className="flex items-center gap-0.5">
      <kbd className="inline-flex items-center justify-center rounded font-mono bg-muted border border-border/50 shadow-sm min-w-[24px] h-6 px-1.5 text-xs">
        {keys}
      </kbd>
    </div>
  );
}
