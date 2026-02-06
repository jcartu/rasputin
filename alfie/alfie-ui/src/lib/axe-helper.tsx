'use client';

import React, { useEffect } from 'react';

export function AxeAccessibilityReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      import('@axe-core/react').then(({ default: axe }) => {
        import('react-dom').then((ReactDOM) => {
          axe(React, ReactDOM, 1000);
        });
      });
    }
  }, []);

  return null;
}

export async function runAxeAudit(container?: HTMLElement): Promise<{
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: Array<{ html: string; target: string[] }>;
  }>;
  passes: number;
  inapplicable: number;
}> {
  const axe = await import('axe-core');
  const results = await axe.default.run(container || document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });

  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact || 'unknown',
      description: v.description,
      nodes: v.nodes.map((n) => ({
        html: n.html,
        target: n.target.map(String),
      })),
    })),
    passes: results.passes.length,
    inapplicable: results.inapplicable.length,
  };
}

export function logAccessibilityReport(results: Awaited<ReturnType<typeof runAxeAudit>>) {
  console.group('Accessibility Audit Report');
  console.log(`Passes: ${results.passes}`);
  console.log(`Inapplicable: ${results.inapplicable}`);
  console.log(`Violations: ${results.violations.length}`);
  
  if (results.violations.length > 0) {
    console.group('Violations');
    results.violations.forEach((violation) => {
      console.group(`${violation.impact?.toUpperCase()}: ${violation.id}`);
      console.log(violation.description);
      violation.nodes.forEach((node) => {
        console.log('Element:', node.html);
        console.log('Selector:', node.target.join(', '));
      });
      console.groupEnd();
    });
    console.groupEnd();
  }
  
  console.groupEnd();
}
