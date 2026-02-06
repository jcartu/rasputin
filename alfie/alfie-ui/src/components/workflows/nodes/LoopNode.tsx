'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Repeat, List, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { WorkflowNodeData } from '@/lib/workflowStore';

const loopIcons: Record<string, typeof Repeat> = {
  forEach: List,
  while: Repeat,
  counter: Hash,
};

function LoopNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const loopType = (data.config?.loopType as string) || 'forEach';
  const Icon = loopIcons[loopType] || Repeat;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative px-4 py-3 rounded-xl border-2 min-w-[180px]
        bg-gradient-to-br from-purple-500/20 to-purple-600/10
        ${selected ? 'border-purple-400 shadow-lg shadow-purple-500/20' : 'border-purple-500/50'}
        transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600"
      />
      
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/30">
          <Icon className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <div className="text-xs text-purple-400 font-medium uppercase tracking-wider">
            Loop
          </div>
          <div className="text-sm text-white font-semibold">
            {data.label || loopType}
          </div>
        </div>
      </div>
      
      <div className="absolute -right-1 top-1/2 -translate-y-1/2">
        <Repeat className="w-4 h-4 text-purple-400/50" />
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600"
      />
    </motion.div>
  );
}

export default memo(LoopNode);
