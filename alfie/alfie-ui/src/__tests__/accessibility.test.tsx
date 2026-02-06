import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AccessibilityPanel } from '@/components/settings/AccessibilityPanel';

expect.extend(toHaveNoViolations);

jest.mock('@/lib/accessibility', () => ({
  useAccessibilityStore: () => ({
    fontSize: 'medium',
    contrastMode: 'normal',
    reducedMotion: false,
    reducedTransparency: false,
    focusIndicator: 'default',
    focusHighlightColor: '#4f46e5',
    announceMessages: true,
    announceToolCalls: true,
    verboseDescriptions: false,
    enableKeyboardNavigation: true,
    showKeyboardShortcuts: true,
    dyslexicFont: false,
    underlineLinks: false,
    largeClickTargets: false,
    setFontSize: jest.fn(),
    setContrastMode: jest.fn(),
    setReducedMotion: jest.fn(),
    setFocusIndicator: jest.fn(),
    updatePreference: jest.fn(),
    resetToDefaults: jest.fn(),
  }),
  fontSizeScale: {
    small: 0.875,
    medium: 1,
    large: 1.125,
    'extra-large': 1.25,
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<object>) => 
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
}));

describe('Accessibility Panel', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<AccessibilityPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders all accessibility settings sections', () => {
    const { getByText } = render(<AccessibilityPanel />);
    expect(getByText('Vision')).toBeInTheDocument();
    expect(getByText('Motion')).toBeInTheDocument();
    expect(getByText('Focus & Navigation')).toBeInTheDocument();
    expect(getByText('Screen Reader')).toBeInTheDocument();
  });

  it('has proper ARIA labels on interactive elements', () => {
    const { getAllByRole } = render(<AccessibilityPanel />);
    const buttons = getAllByRole('button');
    buttons.forEach((button) => {
      expect(
        button.getAttribute('aria-label') || 
        button.getAttribute('aria-labelledby') || 
        button.textContent
      ).toBeTruthy();
    });
  });
});
