import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Zap,
  BarChart3,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptAnalyticsProps {
  promptId?: number;
  userId?: number;
  className?: string;
}

const MOCK_DAILY_DATA = [
  { date: "Jan 1", runs: 12, successRate: 92, cost: 0.24 },
  { date: "Jan 2", runs: 18, successRate: 89, cost: 0.36 },
  { date: "Jan 3", runs: 15, successRate: 95, cost: 0.30 },
  { date: "Jan 4", runs: 22, successRate: 91, cost: 0.44 },
  { date: "Jan 5", runs: 28, successRate: 88, cost: 0.56 },
  { date: "Jan 6", runs: 25, successRate: 94, cost: 0.50 },
  { date: "Jan 7", runs: 30, successRate: 93, cost: 0.60 },
];

const MOCK_TOKEN_DATA = [
  { date: "Jan 1", input: 1200, output: 2400 },
  { date: "Jan 2", input: 1800, output: 3600 },
  { date: "Jan 3", input: 1500, output: 3000 },
  { date: "Jan 4", input: 2200, output: 4400 },
  { date: "Jan 5", input: 2800, output: 5600 },
  { date: "Jan 6", input: 2500, output: 5000 },
  { date: "Jan 7", input: 3000, output: 6000 },
];

const MOCK_MODEL_COST = [
  { name: "GPT-4 Turbo", value: 2.45, color: "#22d3ee" },
  { name: "Claude 3 Sonnet", value: 1.20, color: "#a78bfa" },
  { name: "Claude 3 Opus", value: 0.85, color: "#f472b6" },
  { name: "Gemini Pro", value: 0.50, color: "#4ade80" },
];

const MOCK_RUN_HISTORY = [
  { id: 1, date: "2024-01-07 14:32", model: "GPT-4 Turbo", success: true, tokens: 1234, cost: 0.025, latency: 1250 },
  { id: 2, date: "2024-01-07 12:15", model: "Claude 3 Sonnet", success: true, tokens: 856, cost: 0.012, latency: 890 },
  { id: 3, date: "2024-01-07 10:45", model: "GPT-4 Turbo", success: false, tokens: 450, cost: 0.009, latency: 2100 },
  { id: 4, date: "2024-01-06 18:20", model: "Gemini Pro", success: true, tokens: 1100, cost: 0.008, latency: 650 },
  { id: 5, date: "2024-01-06 15:05", model: "Claude 3 Opus", success: true, tokens: 2100, cost: 0.042, latency: 1800 },
];

export function PromptAnalytics({ promptId, userId, className }: PromptAnalyticsProps) {
  const stats = useMemo(() => ({
    totalRuns: 150,
    successRate: 92,
    successTrend: 2.5,
    avgLatency: 1150,
    totalCost: 5.00,
    totalTokens: 45000,
  }), []);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            Prompt Analytics
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {promptId ? `Analytics for prompt #${promptId}` : "Your overall prompt usage statistics"}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Runs</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.totalRuns}</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <Zap className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Success Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold text-white">{stats.successRate}%</p>
                  <span className={cn(
                    "flex items-center text-xs",
                    stats.successTrend >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {stats.successTrend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                    {Math.abs(stats.successTrend)}%
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Avg Latency</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.avgLatency}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Cost</p>
                <p className="text-2xl font-bold text-white mt-1">${stats.totalCost.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10">
                <DollarSign className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Tokens Used</p>
                <p className="text-2xl font-bold text-white mt-1">{(stats.totalTokens / 1000).toFixed(1)}k</p>
              </div>
              <div className="p-3 rounded-xl bg-pink-500/10">
                <BarChart3 className="h-5 w-5 text-pink-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Success Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_DAILY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} domain={[80, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="successRate"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={{ fill: "#22d3ee", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#22d3ee" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Runs Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_DAILY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="runs" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Cost by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={MOCK_MODEL_COST}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {MOCK_MODEL_COST.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {MOCK_MODEL_COST.map((model) => (
                  <div key={model.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: model.color }} />
                    <span className="text-zinc-400 flex-1">{model.name}</span>
                    <span className="text-white font-medium">${model.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Token Usage Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_TOKEN_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="input"
                    stackId="1"
                    stroke="#22d3ee"
                    fill="#22d3ee"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="output"
                    stackId="1"
                    stroke="#a78bfa"
                    fill="#a78bfa"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Model</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Tokens</th>
                  <th className="text-right py-2 font-medium">Cost</th>
                  <th className="text-right py-2 font-medium">Latency</th>
                  <th className="text-right py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {MOCK_RUN_HISTORY.map((run) => (
                  <tr key={run.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {run.date}
                      </span>
                    </td>
                    <td className="py-3">
                      <Badge variant="secondary" className="text-xs">{run.model}</Badge>
                    </td>
                    <td className="py-3">
                      {run.success ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right text-sm text-zinc-300">{run.tokens.toLocaleString()}</td>
                    <td className="py-3 text-right text-sm text-zinc-300">${run.cost.toFixed(4)}</td>
                    <td className="py-3 text-right text-sm text-zinc-300">{run.latency}ms</td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default PromptAnalytics;
