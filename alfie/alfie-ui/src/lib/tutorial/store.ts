import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tutorial, TutorialProgress, TutorialStatus, TutorialStep } from './types';
import { getTutorialById } from './steps';

interface TutorialState {
  status: TutorialStatus;
  currentTutorial: Tutorial | null;
  currentStepIndex: number;
  progress: Record<string, TutorialProgress>;
  hasSeenOnboarding: boolean;
  isOverlayVisible: boolean;
  highlightedElement: HTMLElement | null;

  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
  skipTutorial: () => void;
  pauseTutorial: () => void;
  resumeTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: (tutorialId: string) => void;
  resetAllProgress: () => void;
  getCurrentStep: () => TutorialStep | null;
  canGoNext: () => boolean;
  canGoPrevious: () => boolean;
  getTutorialProgress: (tutorialId: string) => TutorialProgress | null;
  setHighlightedElement: (element: HTMLElement | null) => void;
  markOnboardingSeen: () => void;
  shouldShowOnboarding: () => boolean;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      currentTutorial: null,
      currentStepIndex: 0,
      progress: {},
      hasSeenOnboarding: false,
      isOverlayVisible: false,
      highlightedElement: null,

      startTutorial: (tutorialId: string) => {
        const tutorial = getTutorialById(tutorialId);
        if (!tutorial) {
          console.warn(`Tutorial "${tutorialId}" not found`);
          return;
        }

        const existingProgress = get().progress[tutorialId];
        const startIndex = existingProgress?.isComplete 
          ? 0 
          : existingProgress?.currentStepIndex ?? 0;

        set({
          status: 'active',
          currentTutorial: tutorial,
          currentStepIndex: startIndex,
          isOverlayVisible: true,
          progress: {
            ...get().progress,
            [tutorialId]: {
              tutorialId,
              currentStepIndex: startIndex,
              completedSteps: existingProgress?.completedSteps ?? [],
              isComplete: false,
              startedAt: existingProgress?.startedAt ?? new Date(),
            },
          },
        });
      },

      nextStep: () => {
        const { currentTutorial, currentStepIndex, progress } = get();
        if (!currentTutorial) return;

        const currentStep = currentTutorial.steps[currentStepIndex];
        const nextIndex = currentStepIndex + 1;

        if (nextIndex >= currentTutorial.steps.length) {
          get().completeTutorial();
          return;
        }

        const tutorialProgress = progress[currentTutorial.id];
        const completedSteps = tutorialProgress?.completedSteps ?? [];
        if (currentStep && !completedSteps.includes(currentStep.id)) {
          completedSteps.push(currentStep.id);
        }

        set({
          currentStepIndex: nextIndex,
          highlightedElement: null,
          progress: {
            ...progress,
            [currentTutorial.id]: {
              ...tutorialProgress!,
              currentStepIndex: nextIndex,
              completedSteps,
            },
          },
        });
      },

      previousStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex <= 0) return;

        set({
          currentStepIndex: currentStepIndex - 1,
          highlightedElement: null,
        });
      },

      goToStep: (index: number) => {
        const { currentTutorial } = get();
        if (!currentTutorial) return;
        if (index < 0 || index >= currentTutorial.steps.length) return;

        set({
          currentStepIndex: index,
          highlightedElement: null,
        });
      },

      skipTutorial: () => {
        const { currentTutorial, progress } = get();
        if (!currentTutorial) return;

        set({
          status: 'idle',
          currentTutorial: null,
          currentStepIndex: 0,
          isOverlayVisible: false,
          highlightedElement: null,
          progress: {
            ...progress,
            [currentTutorial.id]: {
              ...progress[currentTutorial.id]!,
              isComplete: false,
            },
          },
        });

        if (currentTutorial.id === 'onboarding') {
          set({ hasSeenOnboarding: true });
        }
      },

      pauseTutorial: () => {
        set({ status: 'paused', isOverlayVisible: false });
      },

      resumeTutorial: () => {
        const { currentTutorial } = get();
        if (!currentTutorial) return;
        set({ status: 'active', isOverlayVisible: true });
      },

      completeTutorial: () => {
        const { currentTutorial, progress } = get();
        if (!currentTutorial) return;

        const tutorialProgress = progress[currentTutorial.id];
        
        set({
          status: 'completed',
          isOverlayVisible: false,
          highlightedElement: null,
          progress: {
            ...progress,
            [currentTutorial.id]: {
              ...tutorialProgress!,
              isComplete: true,
              completedAt: new Date(),
              completedSteps: currentTutorial.steps.map(s => s.id),
            },
          },
        });

        if (currentTutorial.id === 'onboarding') {
          set({ hasSeenOnboarding: true });
        }

        setTimeout(() => {
          set({
            status: 'idle',
            currentTutorial: null,
            currentStepIndex: 0,
          });
        }, 100);
      },

      resetTutorial: (tutorialId: string) => {
        const { progress, currentTutorial, status } = get();

        if (currentTutorial?.id === tutorialId && status === 'active') {
          set({
            status: 'idle',
            currentTutorial: null,
            currentStepIndex: 0,
            isOverlayVisible: false,
            highlightedElement: null,
          });
        }

        const newProgress = { ...progress };
        delete newProgress[tutorialId];

        set({
          progress: newProgress,
          hasSeenOnboarding: tutorialId === 'onboarding' ? false : get().hasSeenOnboarding,
        });
      },

      resetAllProgress: () => {
        set({
          status: 'idle',
          currentTutorial: null,
          currentStepIndex: 0,
          progress: {},
          hasSeenOnboarding: false,
          isOverlayVisible: false,
          highlightedElement: null,
        });
      },

      getCurrentStep: () => {
        const { currentTutorial, currentStepIndex } = get();
        if (!currentTutorial) return null;
        return currentTutorial.steps[currentStepIndex] ?? null;
      },

      canGoNext: () => {
        const { currentTutorial, currentStepIndex } = get();
        if (!currentTutorial) return false;
        return currentStepIndex < currentTutorial.steps.length - 1;
      },

      canGoPrevious: () => {
        const { currentStepIndex } = get();
        return currentStepIndex > 0;
      },

      getTutorialProgress: (tutorialId: string) => {
        return get().progress[tutorialId] ?? null;
      },

      setHighlightedElement: (element: HTMLElement | null) => {
        set({ highlightedElement: element });
      },

      markOnboardingSeen: () => {
        set({ hasSeenOnboarding: true });
      },

      shouldShowOnboarding: () => {
        const { hasSeenOnboarding, progress } = get();
        const onboardingProgress = progress['onboarding'];
        return !hasSeenOnboarding && !onboardingProgress?.isComplete;
      },
    }),
    {
      name: 'alfie-tutorial-storage',
      partialize: (state) => ({
        progress: state.progress,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    }
  )
);
