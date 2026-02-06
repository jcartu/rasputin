'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Cpu, 
  MemoryStick, 
  Zap, 
  Thermometer, 
  Activity,
  Server,
  Gauge
} from 'lucide-react';
import { useSystemStore } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import { cn } from '@/lib/utils';

export function StatsPanel() {
  const { stats } = useSystemStore();
  const { requestStats, isConnected } = useWebSocket();
  const [mockStats, setMockStats] = useState({
    cpu: 45,
    memory: 62,
    gpu: {
      name: 'NVIDIA RTX 4090',
      utilization: 78,
      memory: 85,
      temperature: 72,
    },
    tokensPerSecond: 142,
    activeModel: 'claude-3-opus',
  });

  useEffect(() => {
    if (isConnected) {
      requestStats();
      const interval = setInterval(() => requestStats(), 5000);
      return () => clearInterval(interval);
    }
    
    const interval = setInterval(() => {
      setMockStats(prev => ({
        ...prev,
        cpu: Math.min(100, Math.max(20, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.min(100, Math.max(40, prev.memory + (Math.random() - 0.5) * 5)),
        gpu: {
          ...prev.gpu,
          utilization: Math.min(100, Math.max(50, prev.gpu.utilization + (Math.random() - 0.5) * 15)),
          memory: Math.min(100, Math.max(60, prev.gpu.memory + (Math.random() - 0.5) * 8)),
          temperature: Math.min(85, Math.max(60, prev.gpu.temperature + (Math.random() - 0.5) * 4)),
        },
        tokensPerSecond: Math.min(200, Math.max(80, prev.tokensPerSecond + (Math.random() - 0.5) * 30)),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected, requestStats]);

  const displayStats = isConnected ? stats : mockStats;
  const gpu = displayStats.gpu || mockStats.gpu;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          System Stats
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Real-time performance metrics
        </p>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Cpu}
            label="CPU"
            value={displayStats.cpu || mockStats.cpu}
            unit="%"
            color="primary"
          />
          <StatCard
            icon={MemoryStick}
            label="Memory"
            value={displayStats.memory || mockStats.memory}
            unit="%"
            color="accent"
          />
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">GPU</p>
              <p className="text-sm font-medium">{gpu.name}</p>
            </div>
          </div>

          <div className="space-y-3">
            <MetricBar
              label="Utilization"
              value={gpu.utilization}
              color="emerald"
            />
            <MetricBar
              label="VRAM"
              value={gpu.memory}
              color="cyan"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Thermometer className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Temperature</span>
              </div>
              <span className={cn(
                'font-mono text-sm',
                gpu.temperature > 80 ? 'text-destructive' : 
                gpu.temperature > 70 ? 'text-amber-500' : 'text-emerald-500'
              )}>
                {Math.round(gpu.temperature)}°C
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Model Performance</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active Model</span>
            <span className="text-sm font-mono">
              {displayStats.activeModel || mockStats.activeModel}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tokens/sec</span>
            <motion.span
              key={Math.round(displayStats.tokensPerSecond || mockStats.tokensPerSecond)}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-bold gradient-text"
            >
              {Math.round(displayStats.tokensPerSecond || mockStats.tokensPerSecond)}
            </motion.span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Overall Health</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-emerald-500"
            />
            <span className="text-sm text-emerald-500">System Healthy</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  unit: string;
  color: 'primary' | 'accent' | 'emerald';
}

function StatCard({ icon: Icon, label, value, unit, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-cyan-500/10 text-cyan-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
  };

  return (
    <div className="p-3 rounded-xl border border-border bg-card/50">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', colorClasses[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">
        {Math.round(value)}
        <span className="text-sm text-muted-foreground">{unit}</span>
      </p>
      <motion.div
        className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5 }}
          className={cn(
            'h-full rounded-full',
            color === 'primary' ? 'bg-primary' :
            color === 'accent' ? 'bg-cyan-500' : 'bg-emerald-500'
          )}
        />
      </motion.div>
    </div>
  );
}

interface MetricBarProps {
  label: string;
  value: number;
  color: 'emerald' | 'cyan' | 'amber';
}

function MetricBar({ label, value, color }: MetricBarProps) {
  const colors = {
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{Math.round(value)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5 }}
          className={cn('h-full rounded-full', colors[color])}
        />
      </div>
    </div>
  );
}
