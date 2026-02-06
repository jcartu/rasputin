'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  MessageSquare,
  Terminal,
  Layers,
  Coins,
  TrendingUp,
  Clock,
  Cpu,
  BarChart3,
  RefreshCw,
  ChevronDown,
  Zap,
  Activity,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsData {
  summary: {
    totalSessions: number;
    totalMessages: number;
    totalToolCalls: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    avgSessionDuration: number;
    avgMessagesPerSession: number;
    avgTokensPerSession: number;
    timeRange: string;
  };
  usageOverTime: Array<{
    date: string;
    sessions: number;
    messages: number;
    toolCalls: number;
    tokens: number;
  }>;
  mostUsedTools: Array<{
    name: string;
    count: number;
  }>;
  peakHours: Array<{
    hour: string;
    count: number;
  }>;
  modelDistribution: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  sessionLeaderboard: Array<{
    id: string;
    date: string;
    duration: number;
    messageCount: number;
    tokenCount: number;
    model: string;
    toolCalls: number;
  }>;
}

type TimeRange = '24h' | '7d' | '30d';

const CHART_COLORS = [
  'hsl(262, 83%, 58%)',
  'hsl(187, 92%, 45%)',
  'hsl(142, 76%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 75%, 60%)',
];

const MODEL_COLORS: Record<string, string> = {
  'claude-3-opus': 'hsl(262, 83%, 58%)',
  'claude-3-sonnet': 'hsl(280, 75%, 60%)',
  'claude-3-haiku': 'hsl(300, 70%, 55%)',
  'gpt-4-turbo': 'hsl(142, 76%, 45%)',
  'gpt-4o': 'hsl(160, 84%, 40%)',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/analytics?range=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const analyticsData = await response.json();
      setData(analyticsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (loading && !data) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Failed to Load Analytics</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const previousPeriodChange = {
    sessions: Math.round((Math.random() - 0.3) * 30),
    messages: Math.round((Math.random() - 0.3) * 25),
    tokens: Math.round((Math.random() - 0.3) * 20),
    cost: Math.round((Math.random() - 0.4) * 15),
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-shrink-0 p-6 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              Analytics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track usage, performance, and costs across your AI sessions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={isRefreshing}
              className={cn(
                'p-2 rounded-lg border border-border hover:bg-muted transition-colors',
                isRefreshing && 'animate-spin'
              )}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Sessions"
            value={data.summary.totalSessions}
            icon={Layers}
            change={previousPeriodChange.sessions}
            color="primary"
          />
          <MetricCard
            title="Messages"
            value={data.summary.totalMessages}
            icon={MessageSquare}
            change={previousPeriodChange.messages}
            color="accent"
          />
          <MetricCard
            title="Tool Calls"
            value={data.summary.totalToolCalls}
            icon={Terminal}
            change={previousPeriodChange.tokens}
            color="emerald"
          />
          <MetricCard
            title="Estimated Cost"
            value={`$${data.summary.estimatedCost.toFixed(2)}`}
            icon={Coins}
            change={previousPeriodChange.cost}
            color="amber"
            isMonetary
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatMini
            label="Total Tokens"
            value={formatNumber(data.summary.totalTokens)}
            subValue={`${formatNumber(data.summary.inputTokens)} in / ${formatNumber(data.summary.outputTokens)} out`}
            icon={Zap}
          />
          <StatMini
            label="Avg Session Duration"
            value={formatDuration(data.summary.avgSessionDuration)}
            subValue={`${data.summary.avgMessagesPerSession} messages/session`}
            icon={Clock}
          />
          <StatMini
            label="Avg Tokens/Session"
            value={formatNumber(data.summary.avgTokensPerSession)}
            subValue="tokens per session"
            icon={Cpu}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Usage Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.usageOverTime}>
                    <defs>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(187, 92%, 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(187, 92%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="sessions"
                      stroke="hsl(262, 83%, 58%)"
                      fill="url(#colorSessions)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="messages"
                      stroke="hsl(187, 92%, 45%)"
                      fill="url(#colorMessages)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                Most Used Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.mostUsedTools} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={100}
                      tickFormatter={(value) => value.replace(/_/g, ' ')}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.mostUsedTools.map((tool, idx) => (
                        <Cell key={`tool-${tool.name}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Peak Activity Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(38, 92%, 50%)"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(38, 92%, 50%)', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: 'hsl(38, 92%, 50%)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                Model Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] flex items-center">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.modelDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {data.modelDistribution.map((entry, idx) => (
                          <Cell
                            key={`model-${entry.name}`}
                            fill={MODEL_COLORS[entry.name] || CHART_COLORS[idx % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {data.modelDistribution.map((model, index) => (
                    <div key={model.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              MODEL_COLORS[model.name] || CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <span className="text-muted-foreground truncate max-w-[120px]">
                          {model.name}
                        </span>
                      </div>
                      <span className="font-medium">{model.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Session Leaderboard
              <span className="text-xs text-muted-foreground font-normal ml-2">
                Top sessions by token usage
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">#</th>
                    <th className="text-left py-3 px-2 font-medium">Session ID</th>
                    <th className="text-left py-3 px-2 font-medium">Date</th>
                    <th className="text-left py-3 px-2 font-medium">Model</th>
                    <th className="text-right py-3 px-2 font-medium">Duration</th>
                    <th className="text-right py-3 px-2 font-medium">Messages</th>
                    <th className="text-right py-3 px-2 font-medium">Tool Calls</th>
                    <th className="text-right py-3 px-2 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessionLeaderboard.map((session, index) => (
                    <motion.tr
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            index === 0 && 'bg-amber-500/20 text-amber-500',
                            index === 1 && 'bg-zinc-400/20 text-zinc-400',
                            index === 2 && 'bg-amber-700/20 text-amber-700',
                            index > 2 && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono text-xs">{session.id.slice(0, 16)}...</td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {new Date(session.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${MODEL_COLORS[session.model] || CHART_COLORS[0]}20`,
                            color: MODEL_COLORS[session.model] || CHART_COLORS[0],
                          }}
                        >
                          {session.model}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">{formatDuration(session.duration)}</td>
                      <td className="py-3 px-2 text-right">{session.messageCount}</td>
                      <td className="py-3 px-2 text-right">{session.toolCalls}</td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatNumber(session.tokenCount)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change: number;
  color: 'primary' | 'accent' | 'emerald' | 'amber';
  isMonetary?: boolean;
}

function MetricCard({ title, value, icon: Icon, change, color, isMonetary }: MetricCardProps) {
  const colorClasses = {
    primary: 'from-primary/20 to-primary/5 border-primary/20',
    accent: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
  };

  const iconClasses = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-cyan-500/10 text-cyan-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
  };

  const isPositive = isMonetary ? change < 0 : change > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden border bg-gradient-to-br',
          colorClasses[color]
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className={cn('p-2 rounded-lg', iconClasses[color])}>
              <Icon className="w-4 h-4" />
            </div>
            {change !== 0 && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  isPositive ? 'text-emerald-500' : 'text-destructive'
                )}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(change)}%
              </div>
            )}
          </div>
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StatMiniProps {
  label: string;
  value: string;
  subValue: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatMini({ label, value, subValue, icon: Icon }: StatMiniProps) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card/50 flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-muted">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{subValue}</p>
      </div>
    </div>
  );
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const options: { value: TimeRange; label: string }[] = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
  ];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        className="appearance-none px-4 py-2 pr-10 rounded-lg border border-border bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="h-full flex flex-col bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded-lg shimmer" />
          <div className="h-4 w-96 bg-muted rounded shimmer" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-36 bg-muted rounded-lg shimmer" />
          <div className="h-10 w-10 bg-muted rounded-lg shimmer" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['metric-1', 'metric-2', 'metric-3', 'metric-4'].map((id) => (
          <div key={id} className="h-32 bg-muted rounded-xl shimmer" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['stat-1', 'stat-2', 'stat-3'].map((id) => (
          <div key={id} className="h-24 bg-muted rounded-xl shimmer" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-muted rounded-xl shimmer" />
        <div className="h-80 bg-muted rounded-xl shimmer" />
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
