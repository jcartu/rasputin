'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  SkipForward,
  Sparkles,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTutorialStore } from '@/lib/tutorial/store';
import { TutorialPlacement, TutorialStep } from '@/lib/tutorial/types';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useTargetElement(selector: string | undefined) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setElement(null);
      setRect(null);
      return;
    }

    const findElement = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      setElement(el);
      
      if (el) {
        const bounds = el.getBoundingClientRect();
        setRect({
          top: bounds.top,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
        });
      } else {
        setRect(null);
      }
    };

    findElement();
    
    const observer = new MutationObserver(findElement);
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.addEventListener('resize', findElement);
    window.addEventListener('scroll', findElement, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', findElement);
      window.removeEventListener('scroll', findElement, true);
    };
  }, [selector]);

  return { element, rect };
}

function getTooltipPosition(
  rect: SpotlightRect | null,
  placement: TutorialPlacement,
  padding: number = 0
): { top: number; left: number; transform: string } {
  if (!rect || placement === 'center') {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transform: 'translate(-50%, -50%)',
    };
  }

  const gap = 16;
  const paddedRect = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  switch (placement) {
    case 'top':
      return {
        top: paddedRect.top - gap,
        left: paddedRect.left + paddedRect.width / 2,
        transform: 'translate(-50%, -100%)',
      };
    case 'bottom':
      return {
        top: paddedRect.top + paddedRect.height + gap,
        left: paddedRect.left + paddedRect.width / 2,
        transform: 'translate(-50%, 0)',
      };
    case 'left':
      return {
        top: paddedRect.top + paddedRect.height / 2,
        left: paddedRect.left - gap,
        transform: 'translate(-100%, -50%)',
      };
    case 'right':
      return {
        top: paddedRect.top + paddedRect.height / 2,
        left: paddedRect.left + paddedRect.width + gap,
        transform: 'translate(0, -50%)',
      };
    case 'top-left':
      return {
        top: paddedRect.top - gap,
        left: paddedRect.left,
        transform: 'translate(0, -100%)',
      };
    case 'top-right':
      return {
        top: paddedRect.top - gap,
        left: paddedRect.left + paddedRect.width,
        transform: 'translate(-100%, -100%)',
      };
    case 'bottom-left':
      return {
        top: paddedRect.top + paddedRect.height + gap,
        left: paddedRect.left,
        transform: 'translate(0, 0)',
      };
    case 'bottom-right':
      return {
        top: paddedRect.top + paddedRect.height + gap,
        left: paddedRect.left + paddedRect.width,
        transform: 'translate(-100%, 0)',
      };
    default:
      return {
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        transform: 'translate(-50%, -50%)',
      };
  }
}

interface SpotlightMaskProps {
  rect: SpotlightRect | null;
  padding: number;
  allowInteraction?: boolean;
  onClick?: () => void;
}

function SpotlightMask({ rect, padding, allowInteraction, onClick }: SpotlightMaskProps) {
  if (!rect) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onClick}
      />
    );
  }

  const paddedRect = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998]"
      onClick={onClick}
    >
      <svg className="w-full h-full" role="presentation" aria-hidden="true">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <motion.rect
              initial={{ 
                x: paddedRect.left,
                y: paddedRect.top,
                width: paddedRect.width,
                height: paddedRect.height,
              }}
              animate={{ 
                x: paddedRect.left,
                y: paddedRect.top,
                width: paddedRect.width,
                height: paddedRect.height,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              rx="12"
              ry="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#spotlight-mask)"
          className="backdrop-blur-sm"
        />
      </svg>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-transparent"
        style={{
          top: paddedRect.top,
          left: paddedRect.left,
          width: paddedRect.width,
          height: paddedRect.height,
          pointerEvents: allowInteraction ? 'none' : 'auto',
        }}
      >
        <motion.div
          animate={{
            boxShadow: [
              '0 0 0 0 hsl(var(--primary) / 0.4)',
              '0 0 0 8px hsl(var(--primary) / 0)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 rounded-xl"
        />
      </motion.div>
    </motion.div>
  );
}

interface TooltipCardProps {
  step: TutorialStep;
  position: { top: number; left: number; transform: string };
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLastStep: boolean;
}

function TooltipCard({
  step,
  position,
  currentIndex,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  canGoPrevious,
  isLastStep,
}: TooltipCardProps) {
  const isCenter = step.placement === 'center';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'fixed z-[9999] w-[340px] max-w-[90vw]',
        isCenter && 'w-[400px]'
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
      }}
    >
      <div className={cn(
        'bg-card border border-border rounded-2xl shadow-2xl overflow-hidden',
        'ring-1 ring-primary/20'
      )}>
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <p className="text-xs text-muted-foreground">
                Step {currentIndex + 1} of {totalSteps}
              </p>
            </div>
            {step.showSkip !== false && !isLastStep && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkip}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.content}
          </p>
        </div>

        <div className="p-4 pt-0 space-y-4">
          <StepProgress currentIndex={currentIndex} totalSteps={totalSteps} />

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {!isLastStep && step.showSkip !== false && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="gap-1 text-muted-foreground"
              >
                Skip Tutorial
                <SkipForward className="w-4 h-4" />
              </Button>
            )}

            <Button
              onClick={onNext}
              size="sm"
              className={cn(
                'gap-1 min-w-[100px]',
                isLastStep
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                  : 'bg-gradient-to-r from-primary to-accent hover:opacity-90'
              )}
            >
              {isLastStep ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface StepProgressProps {
  currentIndex: number;
  totalSteps: number;
}

function StepProgress({ currentIndex, totalSteps }: StepProgressProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => `progress-step-${i}`);
  
  return (
    <div className="flex items-center justify-center gap-1.5">
      {steps.map((stepKey, index) => (
        <motion.div
          key={stepKey}
          initial={false}
          animate={{
            scale: index === currentIndex ? 1.2 : 1,
          }}
          className="relative"
        >
          {index < currentIndex ? (
            <CheckCircle2 className="w-3 h-3 text-primary" />
          ) : index === currentIndex ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-primary"
            />
          ) : (
            <Circle className="w-3 h-3 text-muted-foreground/40" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function TutorialOverlay() {
  const {
    status,
    currentTutorial,
    currentStepIndex,
    isOverlayVisible,
    nextStep,
    previousStep,
    skipTutorial,
    canGoNext,
    canGoPrevious,
    getCurrentStep,
  } = useTutorialStore();

  const currentStep = getCurrentStep();
  const { rect } = useTargetElement(currentStep?.target);

  const handleNext = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const handlePrevious = useCallback(() => {
    previousStep();
  }, [previousStep]);

  const handleSkip = useCallback(() => {
    skipTutorial();
  }, [skipTutorial]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'active') return;
      
      switch (e.key) {
        case 'Escape':
          handleSkip();
          break;
        case 'ArrowRight':
        case 'Enter':
          handleNext();
          break;
        case 'ArrowLeft':
          if (canGoPrevious()) handlePrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleNext, handlePrevious, handleSkip, canGoPrevious]);

  if (status !== 'active' || !isOverlayVisible || !currentTutorial || !currentStep) {
    return null;
  }

  const tooltipPosition = getTooltipPosition(
    rect,
    currentStep.placement || 'bottom',
    currentStep.spotlightPadding || 0
  );

  const isLastStep = currentStepIndex === currentTutorial.steps.length - 1;

  return (
    <AnimatePresence>
      <SpotlightMask
        rect={rect}
        padding={currentStep.spotlightPadding || 0}
        allowInteraction={currentStep.allowInteraction}
      />
      <TooltipCard
        step={currentStep}
        position={tooltipPosition}
        currentIndex={currentStepIndex}
        totalSteps={currentTutorial.steps.length}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={handleSkip}
        canGoNext={canGoNext()}
        canGoPrevious={canGoPrevious()}
        isLastStep={isLastStep}
      />
    </AnimatePresence>
  );
}
