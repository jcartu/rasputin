'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Plus, Moon, Sun, Sparkles } from 'lucide-react';
import { useTheme, builtInThemes, Theme } from '@/lib/themes';
import { ThemePreview, ThemePreviewCard } from './ThemePreview';
import { CustomThemeBuilder } from './CustomThemeBuilder';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ThemeSelectorProps {
  trigger?: React.ReactNode;
}

export function ThemeSelector({ trigger }: ThemeSelectorProps) {
  const { 
    activeThemeId, 
    setActiveTheme, 
    customThemes, 
    deleteCustomTheme,
    transitionsEnabled,
    setTransitionsEnabled,
    activeTheme
  } = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);

  const handleThemeSelect = (themeId: string) => {
    setActiveTheme(themeId);
  };

  const handleEditTheme = (theme: Theme) => {
    setEditingTheme(theme);
    setShowBuilder(true);
  };

  const handleDeleteTheme = (themeId: string) => {
    if (confirm('Are you sure you want to delete this theme?')) {
      deleteCustomTheme(themeId);
    }
  };

  const handleBuilderClose = () => {
    setShowBuilder(false);
    setEditingTheme(null);
  };

  const defaultTrigger = (
    <Button variant="ghost" size="icon" className="relative">
      <Palette className="h-5 w-5" />
      <span className="sr-only">Choose theme</span>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Theme Settings
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {showBuilder ? (
            <motion.div
              key="builder"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <CustomThemeBuilder 
                editTheme={editingTheme} 
                onClose={handleBuilderClose}
              />
            </motion.div>
          ) : (
            <motion.div
              key="selector"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Tabs defaultValue="themes" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="themes">Themes</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="themes" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Built-in Themes
                    </h3>
                    <div className="flex items-center gap-2">
                      {activeTheme && (
                        <span className="text-xs text-muted-foreground">
                          Current: {activeTheme.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <ScrollArea className="h-[300px] pr-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {builtInThemes.map((theme) => (
                        <ThemePreviewCard
                          key={theme.id}
                          theme={theme}
                          isActive={activeThemeId === theme.id}
                          onClick={() => handleThemeSelect(theme.id)}
                        />
                      ))}
                    </div>

                    {customThemes.length > 0 && (
                      <>
                        <div className="mt-6 mb-4">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Custom Themes
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {customThemes.map((theme) => (
                            <ThemePreviewCard
                              key={theme.id}
                              theme={theme}
                              isActive={activeThemeId === theme.id}
                              onClick={() => handleThemeSelect(theme.id)}
                              onEdit={() => handleEditTheme(theme)}
                              onDelete={() => handleDeleteTheme(theme.id)}
                              showActions
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </ScrollArea>

                  <Button
                    onClick={() => setShowBuilder(true)}
                    className="w-full"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Custom Theme
                  </Button>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span className="font-medium">Smooth Transitions</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Enable smooth color transitions when switching themes
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTransitionsEnabled(!transitionsEnabled)}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          transitionsEnabled ? 'bg-primary' : 'bg-muted'
                        )}
                        role="switch"
                        aria-checked={transitionsEnabled}
                        aria-label="Toggle smooth transitions"
                      >
                        <span
                          className={cn(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            transitionsEnabled ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </div>

                    <div className="p-4 rounded-lg border bg-card">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {activeTheme?.isDark ? (
                            <Moon className="w-4 h-4 text-primary" />
                          ) : (
                            <Sun className="w-4 h-4 text-primary" />
                          )}
                          <span className="font-medium">Quick Theme Toggle</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Quickly switch between light and dark variants
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={activeThemeId === 'light' ? 'default' : 'outline'}
                            onClick={() => handleThemeSelect('light')}
                          >
                            <Sun className="w-4 h-4 mr-2" />
                            Light
                          </Button>
                          <Button
                            size="sm"
                            variant={activeThemeId === 'dark' ? 'default' : 'outline'}
                            onClick={() => handleThemeSelect('dark')}
                          >
                            <Moon className="w-4 h-4 mr-2" />
                            Dark
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-card">
                      <h4 className="font-medium mb-3">Current Theme Preview</h4>
                      {activeTheme && (
                        <div className="flex items-center gap-4">
                          <ThemePreview theme={activeTheme} size="lg" isActive />
                          <div>
                            <p className="font-medium">{activeTheme.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {activeTheme.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {activeTheme.isDark ? 'Dark theme' : 'Light theme'}
                              {!activeTheme.isBuiltIn && ' - Custom'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export function QuickThemeToggle() {
  const { activeTheme, setActiveTheme } = useTheme();
  
  const toggleTheme = () => {
    if (activeTheme?.isDark) {
      setActiveTheme('light');
    } else {
      setActiveTheme('dark');
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {activeTheme?.isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
