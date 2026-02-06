'use client';

import dynamic from 'next/dynamic';

const WorkflowBuilder = dynamic(
  () => import('@/components/workflows/WorkflowBuilder'),
  { ssr: false }
);

export default function WorkflowBuilderPage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <WorkflowBuilder />
    </div>
  );
}
