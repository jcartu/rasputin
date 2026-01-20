import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Network, 
  Search, 
  Zap, 
  Database, 
  Cpu, 
  Activity, 
  Lock, 
  Globe, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Send,
  Mic,
  StopCircle,
  ChevronRight,
  ChevronDown,
  Layers,
  GitMerge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { useVoice } from '@/hooks/useVoice';
import { jsPDF } from 'jspdf';
import HolographicConsensus from '@/components/HolographicConsensus';
import { DeepChat } from '@/components/DeepChat';
import ThemeSelector from '@/components/ThemeSelector';
import { useTheme } from '@/contexts/JarvisThemeContext';

// Types for Research Mode
type ResearchMode = 'consensus' | 'synthesis';
type ResearchSpeed = 'fast' | 'normal' | 'deep';

interface ModelStatus {
  id: string;
  name: string;
  status: 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';
  latency?: number;
  tokens?: number;
  cost?: number;
  confidence?: number;
  color: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ResearchTask {
  id: string;
  title: string;
  mode: ResearchMode;
  status: 'active' | 'complete' | 'failed' | 'pending';
  timestamp: string;
  progress: number;
}

export default function Research() {
  const { speak } = useVoice();
  const { theme, setTheme } = useTheme();
  // State
  const [mode, setMode] = useState<ResearchMode>('consensus');
  const [speed, setSpeed] = useState<ResearchSpeed>('normal');
  const [query, setQuery] = useState('');
  const [chameleonMode, setChameleonMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasks, setTasks] = useState<ResearchTask[]>([
    { id: 't-1', title: 'Quantum Error Correction', mode: 'consensus', status: 'complete', timestamp: '09:42:15', progress: 100 },
    { id: 't-2', title: 'LK-99 Replication', mode: 'synthesis', status: 'complete', timestamp: '10:15:33', progress: 100 },
  ]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [models, setModels] = useState<ModelStatus[]>([
    { id: 'gpt-5', name: 'GPT-5.2 Pro', status: 'idle', color: 'text-green-400' },
    { id: 'claude-opus', name: 'Claude 4.5 Opus', status: 'idle', color: 'text-purple-400' },
    { id: 'gemini-pro', name: 'Gemini 3.0 Pro', status: 'idle', color: 'text-blue-400' },
    { id: 'grok-4', name: 'Grok 4', status: 'idle', color: 'text-red-400' },
    { id: 'sonar-pro', name: 'Sonar Pro', status: 'idle', color: 'text-yellow-400' },
  ]);
  const [showDeepChat, setShowDeepChat] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string>('');

  // Refs for auto-scrolling logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);



  // Scenario Definitions
  const scenarios = {
    medical: {
      title: "Rare Disease Diagnosis",
      mode: "synthesis" as ResearchMode,
      query: "Analyze patient symptoms: fever, rash, joint pain, recent travel to Brazil. Rule out Zika/Dengue.",
      steps: [] // Handled by DeepChat
    },
    legal: {
      title: "AI Copyright Precedent",
      mode: "synthesis" as ResearchMode,
      query: "Summarize US court rulings on AI training data fair use (2024-2025). Focus on NYT v. OpenAI.",
      steps: [] // Handled by DeepChat
    },
    market: {
      title: "GPU Supply Chain Q3",
      mode: "consensus" as ResearchMode,
      query: "Predict H200 GPU supply bottlenecks for Q3 2025. Analyze TSMC CoWoS capacity.",
      steps: [] // Handled by DeepChat
    },
    code: {
      title: "Smart Contract Audit",
      mode: "consensus" as ResearchMode,
      query: "Audit Solidity contract for reentrancy vulnerabilities. Check OpenZeppelin compliance.",
      steps: [] // Handled by DeepChat
    }
  };

  const runScenario = (key: keyof typeof scenarios) => {
    const scenario = scenarios[key];
    setQuery(scenario.query);
    setMode(scenario.mode);

    // Chameleon Mode Logic
    if (chameleonMode) {
      if (key === 'medical') setTheme('ice-white');
      else if (key === 'legal') setTheme('solar-gold');
      else if (key === 'market') setTheme('deep-ocean');
      else if (key === 'code') setTheme('matrix-green');
    }
    
    // Create new task
    const newTaskId = Math.random().toString(36).substring(7);
    const newTask: ResearchTask = {
      id: newTaskId,
      title: scenario.title,
      mode: scenario.mode,
      status: 'active',
      timestamp: new Date().toLocaleTimeString(),
      progress: 0
    };
    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTaskId);

    // Start DeepChat for all scenarios
    setActiveScenario(key);
    setShowDeepChat(true);
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    playSound('scan', theme);
    speak(`Initiating ${scenario.title} protocol.`);
  };

  const runConsensusDemo = (taskId: string) => {
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    playSound('scan', theme);
    
    setModels(prev => prev.map(m => ({ ...m, status: 'thinking', latency: 0, tokens: 0, cost: 0 })));

    addLog('SYSTEM', 'Initiating PARALLEL CONSENSUS protocol...', 'info');
    addLog('ROUTER', `Dispatching query to ${models.length} frontier models`, 'info');
    playSound('type', theme);
    speak("Initiating parallel consensus protocol. Dispatching query to frontier models.");

    let currentProgress = 0;
    // Slower interval for longer demo (300ms vs 100ms)
    const interval = setInterval(() => {
      // Slower progress increment (0.5% per tick = ~200 ticks = ~60s max)
      currentProgress += 0.5; 
      const progressVal = Math.min(currentProgress, 100);
      setProgress(progressVal);
      
      // Update task progress
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress: progressVal } : t));
      
      // Random events based on progress phases
      if (Math.random() > 0.7) {
        if (currentProgress < 20) {
           addLog('ROUTER', `Handshaking with model endpoints...`, 'info');
        } else if (currentProgress > 40 && currentProgress < 60) {
           addLog('CONSENSUS', `Cross-checking vector embeddings...`, 'warning');
        } else if (currentProgress > 80 && currentProgress < 90) {
           addLog('VERIFIER', `Validating citation integrity...`, 'success');
        }
      }

      setModels(prev => prev.map(m => {
        // Staggered start for models
        if (m.status === 'thinking' && Math.random() > 0.95) {
            playSound('success', theme);
            addLog('NETWORK', `Stream connected: ${m.name}`, 'success');
            return { ...m, status: 'streaming', latency: Math.floor(Math.random() * 500) + 200 };
        }
        
        // Variable token generation speed
        if (m.status === 'streaming') {
            if (Math.random() > 0.5) {
                playSound('processing', theme);
                return { ...m, tokens: (m.tokens || 0) + Math.floor(Math.random() * 15) };
            }
        }
        return m;
      }));

      if (currentProgress >= 100) {
        clearInterval(interval);
        finishResearch(taskId);
      }
    }, 200);
  };

  const runSynthesisDemo = (taskId: string, steps: any[]) => {
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    playSound('scan', theme);
    speak("Starting deep synthesis. Decomposing query vectors.");

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        const step = steps[stepIndex];
        addLog('SYNTHESIS', step.msg, step.type as any);
        playSound(step.type === 'success' ? 'success' : 'type', theme);
        
        // Narrate key milestones
        if (step.type === 'success' || step.type === 'error') {
           // Clean up message for speech (remove brackets, urls)
           const speechText = step.msg.replace(/\[.*?\]/g, '').replace(/https?:\/\/\S+/g, 'source');
           speak(speechText);
        }

        const progressVal = ((stepIndex + 1) / steps.length) * 100;
        setProgress(progressVal);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress: progressVal } : t));
        
        stepIndex++;
      } else {
        clearInterval(interval);
        finishResearch(taskId);
      }
    }, 3000); // Slower for narration
  };

  const startResearch = () => {
    if (!query.trim()) return;
    // Default to generic demo if manual input
    const newTaskId = Math.random().toString(36).substring(7);
    const newTask: ResearchTask = {
      id: newTaskId,
      title: "Manual Research Task",
      mode: mode,
      status: 'active',
      timestamp: new Date().toLocaleTimeString(),
      progress: 0
    };
    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTaskId);

    if (mode === 'consensus') runConsensusDemo(newTaskId);
    else runSynthesisDemo(newTaskId, [
      { msg: "Decomposing query into sub-tasks...", type: "info" },
      { msg: "Searching knowledge base...", type: "warning" },
      { msg: "Synthesizing results...", type: "success" }
    ]);
  };

  const generatePDF = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setTextColor(6, 182, 212); // Cyan
    doc.setFontSize(24);
    doc.text("JARVIS v3 // RESEARCH CORE", 20, 30);
    
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`MISSION ID: ${task.id.toUpperCase()}`, 20, 45);
    doc.text(`TIMESTAMP: ${new Date().toLocaleString()}`, 20, 52);
    doc.text(`MODE: ${task.mode.toUpperCase()}`, 20, 59);
    
    // Divider
    doc.setDrawColor(6, 182, 212);
    doc.line(20, 65, 190, 65);
    
    // Content
    doc.setFontSize(16);
    doc.setTextColor(6, 182, 212);
    doc.text("EXECUTIVE SUMMARY", 20, 80);
    
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 200);
    const summary = `This report was generated autonomously by the JARVIS v3 Neural Engine. The system utilized ${task.mode === 'consensus' ? 'parallel multi-model consensus' : 'deep recursive synthesis'} to analyze the query: "${task.title}".\n\nKey findings have been verified against ${task.mode === 'consensus' ? '5 frontier models' : 'real-time knowledge bases'} with a confidence interval of 99.9%.`;
    
    const splitSummary = doc.splitTextToSize(summary, 170);
    doc.text(splitSummary, 20, 90);
    
    // Logs
    doc.setFontSize(16);
    doc.setTextColor(6, 182, 212);
    doc.text("MISSION LOGS", 20, 130);
    
    let yPos = 140;
    doc.setFontSize(9);
    doc.setFont("monospace");
    
    logs.forEach(log => {
      if (yPos > 270) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 210, 297, 'F');
        yPos = 20;
      }
      
      const time = log.timestamp;
      const source = log.source.padEnd(10);
      const line = `[${time}] ${source} | ${log.message}`;
      
      if (log.type === 'error') doc.setTextColor(239, 68, 68);
      else if (log.type === 'success') doc.setTextColor(34, 197, 94);
      else if (log.type === 'warning') doc.setTextColor(234, 179, 8);
      else doc.setTextColor(150, 150, 150);
      
      doc.text(line, 20, yPos);
      yPos += 6;
    });
    
    doc.save(`JARVIS_MISSION_${task.id.toUpperCase()}.pdf`);
    playSound('success');
  };

  const finishResearch = (taskId: string) => {
    setIsProcessing(false);
    setModels(prev => prev.map(m => ({ 
      ...m, 
      status: 'complete', 
      cost: (m.tokens || 0) * 0.00001 
    })));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'complete', progress: 100 } : t));
    addLog('SYSTEM', 'Process complete. Report generated.', 'success');
    playSound('success');
    speak("Research complete. Final report generated.");
  };

  const addLog = (source: string, message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      source,
      message,
      type
    }]);
  };

  return (
    <div className="min-h-screen bg-black text-cyan-500 font-mono p-4 md:p-8 overflow-hidden relative">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#083344_1px,transparent_1px),linear-gradient(to_bottom,#083344_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-cyan-950/30 border border-cyan-800 rounded-lg">
            <Brain className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wider">RESEARCH CORE</h1>
            <div className="flex items-center gap-2 text-xs text-cyan-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              MULTI-MODEL CONSENSUS ENGINE ONLINE
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeSelector />
          <div className="flex bg-black/40 border border-cyan-900/50 rounded-lg p-1">
            <button 
              onClick={() => { setMode('consensus'); playSound('type'); }}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-bold transition-all",
                mode === 'consensus' ? "bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]" : "text-cyan-700 hover:text-cyan-500"
              )}
            >
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4" />
                CONSENSUS
              </div>
            </button>
            <button 
              onClick={() => { setMode('synthesis'); playSound('type'); }}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-bold transition-all",
                mode === 'synthesis' ? "bg-purple-500/20 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]" : "text-cyan-700 hover:text-cyan-500"
              )}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                SYNTHESIS
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        
        {/* Left Column: Mission Log & Input */}
        <div className="lg:col-span-3 flex flex-col gap-6 h-full">
          
          {/* Mission Log Sidebar */}
          <div className="flex-1 bg-black/40 border border-cyan-900/50 rounded-xl p-4 backdrop-blur-sm overflow-hidden flex flex-col">
            <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2 border-b border-cyan-900/30 pb-2">
              <Layers className="w-4 h-4" />
              MISSION LOG
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-cyan-900/50">
              {tasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => { setActiveTaskId(task.id); playSound('type'); }}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:bg-cyan-900/20 group",
                    activeTaskId === task.id 
                      ? "bg-cyan-900/30 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                      : "bg-black/20 border-cyan-900/30 hover:border-cyan-700"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-cyan-100 truncate max-w-[140px]">{task.title}</span>
                    <span className="text-[10px] font-mono text-cyan-600">{task.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      {task.mode === 'consensus' ? <GitMerge className="w-3 h-3 text-cyan-400" /> : <Layers className="w-3 h-3 text-purple-400" />}
                      <span className="text-[10px] uppercase text-cyan-500/80">{task.mode}</span>
                    </div>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      task.status === 'active' ? "bg-green-500 animate-pulse" :
                      task.status === 'complete' ? "bg-cyan-600" : "bg-red-500"
                    )} />
                  </div>
                  {task.status === 'active' && (
                    <div className="mt-2 h-1 bg-cyan-900/30 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${task.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="bg-black/40 border border-cyan-900/50 rounded-xl p-4 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              CONFIGURATION
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-cyan-700 mb-2 block">RESEARCH DEPTH</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['fast', 'normal', 'deep'] as ResearchSpeed[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpeed(s); playSound('type'); }}
                      className={cn(
                        "py-2 text-xs font-bold border rounded transition-all uppercase",
                        speed === s 
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                          : "border-cyan-900/50 text-cyan-800 hover:border-cyan-700"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-cyan-700 mb-2 block">ACTIVE MODELS</label>
                <div className="flex flex-wrap gap-2">
                  {models.map(model => (
                    <div key={model.id} className={cn(
                      "px-2 py-1 rounded text-[10px] border flex items-center gap-1",
                      model.status !== 'idle' ? "border-cyan-500/50 bg-cyan-900/20" : "border-cyan-900/30 text-cyan-800"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", model.status !== 'idle' ? "bg-green-500 animate-pulse" : "bg-gray-700")} />
                      {model.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-1 bg-black/40 border border-cyan-900/50 rounded-xl p-6 backdrop-blur-sm flex flex-col">
            <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" />
              QUERY PARAMETERS
            </h3>
            
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter research topic or complex query..."
              className="flex-1 bg-black/50 border border-cyan-900/30 rounded-lg p-4 text-cyan-100 placeholder-cyan-900/50 resize-none focus:outline-none focus:border-cyan-500/50 transition-all font-mono text-sm"
            />
            
            {/* Scenario Quick Links */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-900/50">
              <button onClick={() => { runScenario('medical'); playSound('type', theme); }} className="text-[10px] px-2 py-1 bg-cyan-900/20 border border-cyan-900/50 rounded text-cyan-400 hover:bg-cyan-900/40 whitespace-nowrap transition-all hover:scale-105">
                RUN SIMULATION: MEDICAL
              </button>
              <button onClick={() => { runScenario('legal'); playSound('type', theme); }} className="text-[10px] px-2 py-1 bg-cyan-900/20 border border-cyan-900/50 rounded text-cyan-400 hover:bg-cyan-900/40 whitespace-nowrap transition-all hover:scale-105">
                RUN SIMULATION: LEGAL
              </button>
              <button onClick={() => { runScenario('market'); playSound('type', theme); }} className="text-[10px] px-2 py-1 bg-cyan-900/20 border border-cyan-900/50 rounded text-cyan-400 hover:bg-cyan-900/40 whitespace-nowrap transition-all hover:scale-105">
                RUN SIMULATION: MARKET
              </button>
              <button onClick={() => { runScenario('code'); playSound('type', theme); }} className="text-[10px] px-2 py-1 bg-cyan-900/20 border border-cyan-900/50 rounded text-cyan-400 hover:bg-cyan-900/40 whitespace-nowrap transition-all hover:scale-105">
                RUN SIMULATION: CODE
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {activeTaskId && tasks.find(t => t.id === activeTaskId)?.status === 'complete' && (
                  <Button 
                    onClick={() => generatePDF(activeTaskId)}
                    className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 mr-2"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    DOWNLOAD REPORT
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="text-cyan-700 hover:text-cyan-400 hover:bg-cyan-900/20">
                  <Mic className="w-5 h-5" />
                </Button>
              </div>
              
              <Button 
                onClick={startResearch}
                disabled={isProcessing || !query.trim()}
                className={cn(
                  "bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-6 transition-all",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" />
                    PROCESSING
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    INITIATE
                    <Send className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Visualization & Results */}
        <div className="lg:col-span-9 flex flex-col gap-6 relative">
          
          {/* Deep Chat Overlay */}
          {showDeepChat && (
            <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-md flex flex-col rounded-xl border border-primary/20 shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 rounded-t-xl">
                <div className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-primary animate-pulse" />
                  <span className="font-bold text-primary">DEEP REASONING ENGINE v3.0</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDeepChat(false)}
                  className="hover:bg-destructive/20 hover:text-destructive"
                >
                  ABORT
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <DeepChat 
                  scenario={activeScenario} 
                  onComplete={() => {
                    setIsProcessing(false);
                    finishResearch(activeTaskId || '');
                  }} 
                />
              </div>
            </div>
          )}

          {/* Telemetry & Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-1/2">
            
            {/* Live Stream Console */}
            <div className="bg-black/60 border border-cyan-900/50 rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-center mb-2 border-b border-cyan-900/30 pb-2">
                <span className="text-cyan-500 font-bold flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  LIVE TELEMETRY
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setChameleonMode(!chameleonMode)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded border transition-all",
                      chameleonMode 
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" 
                        : "bg-transparent border-cyan-900/30 text-cyan-700 hover:text-cyan-500"
                    )}
                  >
                    CHAMELEON: {chameleonMode ? 'ON' : 'OFF'}
                  </button>
                  <span className="text-cyan-800">{logs.length} EVENTS</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="text-cyan-800">[{log.timestamp}]</span>
                    <span className={cn(
                      "font-bold w-16",
                      log.type === 'error' ? "text-red-500" :
                      log.type === 'success' ? "text-green-500" :
                      log.type === 'warning' ? "text-yellow-500" : "text-cyan-600"
                    )}>{log.source}</span>
                    <span className="text-cyan-300/80">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Model Status Cards */}
            <div className="bg-black/40 border border-cyan-900/50 rounded-xl p-4 overflow-y-auto">
              <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <Network className="w-4 h-4" />
                NEURAL SYNC STATUS
              </h3>
              
              {/* Interactive Consensus Graph */}
              {mode === 'consensus' && isProcessing && (
                <div className="mb-6">
                  <HolographicConsensus progress={progress} models={models} />
                </div>
              )}

              <div className="space-y-3">
                {models.map((model) => (
                  <div key={model.id} className="bg-black/40 border border-cyan-900/30 rounded-lg p-3 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        model.status === 'idle' ? "bg-gray-700" :
                        model.status === 'thinking' ? "bg-yellow-500 animate-pulse" :
                        model.status === 'streaming' ? "bg-blue-500 animate-pulse" :
                        model.status === 'complete' ? "bg-green-500" : "bg-red-500"
                      )} />
                      <div>
                        <div className={cn("font-bold text-sm", model.color)}>{model.name}</div>
                        <div className="text-[10px] text-cyan-800 uppercase">{model.status}</div>
                      </div>
                    </div>
                    
                    {model.status !== 'idle' && (
                      <div className="text-right text-[10px] font-mono text-cyan-600">
                        <div>{model.latency ? `${model.latency}ms` : '-'}</div>
                        <div>{model.tokens ? `${model.tokens} tok` : '-'}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="h-1/2 bg-black/40 border border-cyan-900/50 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-900/30">
              <motion.div 
                className="h-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  SYNTHESIZED INTELLIGENCE
                </h3>
                {progress === 100 && (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-bold animate-pulse">
                    <CheckCircle className="w-4 h-4" />
                    CONSENSUS REACHED (98.5%)
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-4 font-sans text-cyan-100/90 leading-relaxed space-y-4 scrollbar-thin scrollbar-thumb-cyan-900/50">
                {progress === 0 && !isProcessing ? (
                  <div className="h-full flex flex-col items-center justify-center text-cyan-900/50">
                    <Brain className="w-16 h-16 mb-4 opacity-20" />
                    <p>Awaiting research parameters...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-cyan max-w-none">
                    {/* Placeholder for actual synthesized content */}
                    <p className="text-cyan-300/50 italic">[System waiting for consensus stream...]</p>
                    {progress > 20 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h4 className="text-cyan-400 font-bold mt-4">Executive Summary</h4>
                        <p>Initial analysis across 5 frontier models indicates a strong convergence on the core query parameters. Key findings suggest...</p>
                      </motion.div>
                    )}
                    {progress > 50 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h4 className="text-cyan-400 font-bold mt-4">Technical Analysis</h4>
                        <p>Deep dive into the architectural implications reveals three primary vectors of impact. GPT-5 and Claude 4.5 Opus show 99% agreement on the following points...</p>
                      </motion.div>
                    )}
                    {progress === 100 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h4 className="text-cyan-400 font-bold mt-4">Strategic Recommendations</h4>
                        <ul className="list-disc pl-4 space-y-2">
                          <li>Immediate implementation of the proposed hybrid architecture.</li>
                          <li>Deployment of redundant safety protocols as suggested by Gemini 3.0 Pro.</li>
                          <li>Continuous monitoring of the consensus drift metrics.</li>
                        </ul>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
