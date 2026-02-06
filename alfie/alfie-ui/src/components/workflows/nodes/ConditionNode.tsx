'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import { WorkflowNodeData } from '@/lib/workflowStore';

function ConditionNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative px-4 py-3 min-w-[180px]
        ${selected ? 'drop-shadow-lg' : ''}
        transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-amber-600"
      />
      
      <div
        className={`
          rotate-45 w-32 h-32 flex items-center justify-center
          border-2 bg-gradient-to-br from-amber-500/20 to-amber-600/10
          ${selected ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-amber-500/50'}
        `}
      >
        <div className="-rotate-45 flex flex-col items-center gap-1">
          <GitBranch className="w-5 h-5 text-amber-400" />
          <div className="text-xs text-amber-400 font-medium uppercase tracking-wider">
            Condition
          </div>
          <div className="text-xs text-white font-semibold text-center max-w-[80px] truncate">
            {data.label || 'Check'}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-emerald-600 !left-[30%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !bg-red-400 !border-2 !border-red-600 !left-[70%]"
      />
      
      <div className="absolute -bottom-6 left-[25%] text-[10px] text-emerald-400">Yes</div>
      <div className="absolute -bottom-6 left-[65%] text-[10px] text-red-400">No</div>
    </motion.div>
  );
}

export default memo(ConditionNode);
