export type TutorialPlacement = 
  | 'top' 
  | 'bottom' 
  | 'left' 
  | 'right' 
  | 'top-left' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-right'
  | 'center';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  placement?: TutorialPlacement;
  spotlightPadding?: number;
  action?: TutorialAction;
  showSkip?: boolean;
  allowInteraction?: boolean;
  waitForElement?: boolean;
  onEnter?: () => void;
  onExit?: () => void;
}

export interface TutorialAction {
  type: 'click' | 'input' | 'wait' | 'custom';
  expectedSelector?: string;
  timeout?: number;
}

export interface TutorialProgress {
  tutorialId: string;
  currentStepIndex: number;
  completedSteps: string[];
  isComplete: boolean;
  startedAt: Date;
  completedAt?: Date;
}

export interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  version: number;
}

export type TutorialStatus = 'idle' | 'active' | 'paused' | 'completed';
