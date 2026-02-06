'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Globe, Terminal, Bell, Wand2, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { WorkflowNodeData } from '@/lib/workflowStore';

const actionIcons: Record<string, typeof Globe> = {
  httpRequest: Globe,
  runScript: Terminal,
  sendNotification: Bell,
  transformData: Wand2,
  delay: Timer,
};

function ActionNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const actionType = (data.config?.actionType as string) || 'httpRequest';
  const Icon = actionIcons[actionType] || Globe;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative px-4 py-3 rounded-xl border-2 min-w-[180px]
        bg-gradient-to-br from-blue-500/20 to-blue-600/10
        ${selected ? 'border-blue-400 shadow-lg shadow-blue-500/20' : 'border-blue-500/50'}
        transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600"
      />
      
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/30">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <div className="text-xs text-blue-400 font-medium uppercase tracking-wider">
            Action
          </div>
          <div className="text-sm text-white font-semibold">
            {data.label || actionType}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600"
      />
    </motion.div>
  );
}

export default memo(ActionNode);
