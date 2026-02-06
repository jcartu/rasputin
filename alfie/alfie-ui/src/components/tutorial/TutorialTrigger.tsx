'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  RotateCcw, 
  Play, 
  CheckCircle2,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTutorialStore } from '@/lib/tutorial/store';
import { allTutorials } from '@/lib/tutorial/steps';

export function TutorialTrigger() {
  const { 
    startTutorial, 
    resetTutorial, 
    resetAllProgress,
    progress,
    status 
  } = useTutorialStore();

  const completedTutorials = allTutorials.filter(
    t => progress[t.id]?.isComplete
  ).length;
  
  const totalTutorials = allTutorials.length;
  const allComplete = completedTutorials === totalTutorials;

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'rounded-xl relative',
                  status === 'active' && 'text-primary'
                )}
              >
                <GraduationCap className="w-5 h-5" />
                {completedTutorials > 0 && !allComplete && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                    {completedTutorials}
                  </span>
                )}
                {allComplete && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </motion.span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Tutorials</TooltipContent>
        </Tooltip>
        
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Interactive Tutorials
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {allTutorials.map(tutorial => {
            const tutorialProgress = progress[tutorial.id];
            const isComplete = tutorialProgress?.isComplete;
            const hasProgress = tutorialProgress && !isComplete;
            
            return (
              <DropdownMenuItem
                key={tutorial.id}
                className="flex items-center gap-3 py-3 cursor-pointer"
                onClick={() => startTutorial(tutorial.id)}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  isComplete 
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : hasProgress 
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-primary/10 text-primary'
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{tutorial.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {isComplete 
                      ? 'Completed' 
                      : hasProgress 
                        ? `Step ${tutorialProgress.currentStepIndex + 1}/${tutorial.steps.length}`
                        : tutorial.description
                    }
                  </div>
                </div>
                {isComplete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetTutorial(tutorial.id);
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </DropdownMenuItem>
            );
          })}
          
          {(completedTutorials > 0) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-muted-foreground"
                onClick={resetAllProgress}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All Progress
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

export function OnboardingPrompt() {
  const { shouldShowOnboarding, startTutorial, markOnboardingSeen } = useTutorialStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (shouldShowOnboarding() && !dismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowOnboarding, dismissed]);

  const handleStart = () => {
    setShowPrompt(false);
    startTutorial('onboarding');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    markOnboardingSeen();
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-24 right-6 z-[9997] max-w-sm"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-4">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0"
                >
                  <GraduationCap className="w-6 h-6 text-white" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base">New to ALFIE?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Take a quick tour to learn the basics and get the most out of your AI assistant.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismiss}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button
                size="sm"
                onClick={handleStart}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
              >
                <Play className="w-4 h-4" />
                Start Tour
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
