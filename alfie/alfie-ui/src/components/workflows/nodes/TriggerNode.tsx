'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Zap, Clock, Webhook, FolderOpen, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { WorkflowNodeData } from '@/lib/workflowStore';

const triggerIcons: Record<string, typeof Zap> = {
  manual: Play,
  schedule: Clock,
  webhook: Webhook,
  fileWatcher: FolderOpen,
};

function TriggerNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const triggerType = (data.config?.triggerType as string) || 'manual';
  const Icon = triggerIcons[triggerType] || Zap;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative px-4 py-3 rounded-xl border-2 min-w-[180px]
        bg-gradient-to-br from-emerald-500/20 to-emerald-600/10
        ${selected ? 'border-emerald-400 shadow-lg shadow-emerald-500/20' : 'border-emerald-500/50'}
        transition-all duration-200
      `}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/30">
          <Icon className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="text-xs text-emerald-400 font-medium uppercase tracking-wider">
            Trigger
          </div>
          <div className="text-sm text-white font-semibold">
            {data.label || triggerType}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-emerald-600"
      />
    </motion.div>
  );
}

export default memo(TriggerNode);
