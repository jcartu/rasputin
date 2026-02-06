import { Tutorial, TutorialStep } from './types';

export const onboardingSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ALFIE!',
    content: 'Your AI-powered assistant with advanced reasoning and tool execution. Let me show you around!',
    placement: 'center',
    showSkip: true,
  },
  {
    id: 'sidebar',
    title: 'Chat Sessions',
    content: 'This is your sidebar. Create new chats, switch between sessions, and manage your conversation history here.',
    target: '[data-tutorial="sidebar"]',
    placement: 'right',
    spotlightPadding: 8,
  },
  {
    id: 'new-chat',
    title: 'Start a New Chat',
    content: 'Click "New Chat" to start a fresh conversation. Each chat is saved automatically.',
    target: '[data-tutorial="new-chat-button"]',
    placement: 'right',
    spotlightPadding: 12,
    allowInteraction: true,
  },
  {
    id: 'chat-area',
    title: 'Conversation Area',
    content: 'This is where the magic happens! Your conversations with ALFIE appear here with real-time streaming responses.',
    target: '[data-tutorial="chat-area"]',
    placement: 'bottom',
    spotlightPadding: 16,
  },
  {
    id: 'chat-input',
    title: 'Message Input',
    content: 'Type your message here and press Enter to send. Use Shift+Enter for multi-line messages.',
    target: '[data-tutorial="chat-input"]',
    placement: 'top',
    spotlightPadding: 12,
  },
  {
    id: 'voice-input',
    title: 'Voice Input',
    content: 'Click the microphone to use voice input. ALFIE supports speech-to-text for hands-free interaction.',
    target: '[data-tutorial="voice-input"]',
    placement: 'top',
    spotlightPadding: 8,
  },
  {
    id: 'header',
    title: 'Status & Controls',
    content: 'Monitor connection status, see when ALFIE is thinking/acting, and toggle dark mode here.',
    target: '[data-tutorial="header"]',
    placement: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'right-panel',
    title: 'Tools & Files Panel',
    content: 'Access tools, browse files, and monitor system stats in this panel. Toggle it with the panel button.',
    target: '[data-tutorial="right-panel"]',
    placement: 'left',
    spotlightPadding: 8,
  },
  {
    id: 'tools-tab',
    title: 'Available Tools',
    content: 'ALFIE can execute various tools like file operations, code generation, and system commands. View active tools here.',
    target: '[data-tutorial="tools-tab"]',
    placement: 'left',
    spotlightPadding: 8,
  },
  {
    id: 'theme-toggle',
    title: 'Theme Toggle',
    content: 'Switch between light and dark mode to match your preference.',
    target: '[data-tutorial="theme-toggle"]',
    placement: 'bottom-left',
    spotlightPadding: 8,
    allowInteraction: true,
  },
  {
    id: 'panel-toggle',
    title: 'Toggle Panel',
    content: 'Show or hide the right panel to maximize your chat space when needed.',
    target: '[data-tutorial="panel-toggle"]',
    placement: 'bottom-left',
    spotlightPadding: 8,
    allowInteraction: true,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    content: 'You now know the basics of ALFIE. Start chatting to explore AI-powered reasoning, tool execution, and more. Enjoy!',
    placement: 'center',
    showSkip: false,
  },
];

export const onboardingTutorial: Tutorial = {
  id: 'onboarding',
  name: 'Getting Started',
  description: 'Learn the basics of ALFIE',
  steps: onboardingSteps,
  version: 1,
};

export const featureTutorials: Tutorial[] = [
  {
    id: 'voice-features',
    name: 'Voice Features',
    description: 'Learn to use voice input and output',
    steps: [
      {
        id: 'voice-intro',
        title: 'Voice Features',
        content: 'ALFIE supports both voice input and text-to-speech output for a more natural interaction.',
        placement: 'center',
      },
      {
        id: 'voice-settings',
        title: 'Voice Settings',
        content: 'Customize voice settings including speed, voice selection, and auto-play preferences.',
        target: '[data-tutorial="voice-settings"]',
        placement: 'top',
        spotlightPadding: 8,
      },
    ],
    version: 1,
  },
  {
    id: 'advanced-tools',
    name: 'Advanced Tools',
    description: 'Master ALFIE\'s tool capabilities',
    steps: [
      {
        id: 'tools-intro',
        title: 'Advanced Tools',
        content: 'ALFIE can execute various tools to help you with tasks like file management and code execution.',
        placement: 'center',
      },
      {
        id: 'file-browser',
        title: 'File Browser',
        content: 'Browse and select files directly from ALFIE\'s interface.',
        target: '[data-tutorial="files-tab"]',
        placement: 'left',
        spotlightPadding: 8,
      },
      {
        id: 'system-stats',
        title: 'System Stats',
        content: 'Monitor system performance including CPU, memory, and GPU usage.',
        target: '[data-tutorial="stats-tab"]',
        placement: 'left',
        spotlightPadding: 8,
      },
    ],
    version: 1,
  },
];

export const allTutorials: Tutorial[] = [
  onboardingTutorial,
  ...featureTutorials,
];

export function getTutorialById(id: string): Tutorial | undefined {
  return allTutorials.find(t => t.id === id);
}
