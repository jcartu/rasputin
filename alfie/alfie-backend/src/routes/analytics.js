import { Router } from 'express';

const router = Router();

// In-memory analytics storage (would be a database in production)
const analyticsData = {
  sessions: [],
  messages: [],
  toolCalls: [],
  modelUsage: {},
  hourlyUsage: {},
  dailyUsage: {},
};

// Helper to generate mock historical data for demo
function generateMockData() {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  
  // Models used
  const models = ['claude-opus-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'gpt-4o', 'gpt-4o-mini'];
  
  // Tools available
  const tools = [
    'read_file', 'write_file', 'execute_command', 'search_code', 
    'web_search', 'git_commit', 'run_tests', 'lint_code', 
    'create_file', 'delete_file', 'list_files', 'edit_file'
  ];
  
  // Generate 30 days of data
  const sessions = [];
  const messages = [];
  const toolCallsData = [];
  
  for (let day = 29; day >= 0; day--) {
    const dayStart = now - (day * DAY);
    const sessionsPerDay = Math.floor(Math.random() * 8) + 3; // 3-10 sessions per day
    
    for (let s = 0; s < sessionsPerDay; s++) {
      const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const sessionStart = dayStart + Math.floor(Math.random() * 12 * HOUR);
      const duration = Math.floor(Math.random() * 120) + 10; // 10-130 minutes
      const messagesInSession = Math.floor(Math.random() * 30) + 5;
      const model = models[Math.floor(Math.random() * models.length)];
      
      sessions.push({
        id: sessionId,
        startTime: sessionStart,
        endTime: sessionStart + duration * 60000,
        duration,
        messageCount: messagesInSession,
        model,
        totalTokens: Math.floor(Math.random() * 50000) + 5000,
        inputTokens: Math.floor(Math.random() * 20000) + 2000,
        outputTokens: Math.floor(Math.random() * 30000) + 3000,
      });
      
      // Generate messages for this session
      for (let m = 0; m < messagesInSession; m++) {
        const isUser = m % 2 === 0;
        const msgTime = sessionStart + (m * (duration * 60000 / messagesInSession));
        
        messages.push({
          id: `msg_${Math.random().toString(36).slice(2, 10)}`,
          sessionId,
          role: isUser ? 'user' : 'assistant',
          timestamp: msgTime,
          tokenCount: isUser ? Math.floor(Math.random() * 500) + 50 : Math.floor(Math.random() * 2000) + 100,
        });
        
        // Generate tool calls for assistant messages
        if (!isUser && Math.random() > 0.3) {
          const numToolCalls = Math.floor(Math.random() * 4) + 1;
          for (let t = 0; t < numToolCalls; t++) {
            const tool = tools[Math.floor(Math.random() * tools.length)];
            toolCallsData.push({
              id: `tc_${Math.random().toString(36).slice(2, 10)}`,
              sessionId,
              tool,
              timestamp: msgTime + (t * 1000),
              duration: Math.floor(Math.random() * 5000) + 100,
              success: Math.random() > 0.05,
            });
          }
        }
      }
    }
  }
  
  return { sessions, messages, toolCalls: toolCallsData };
}

// Initialize with mock data
const mockData = generateMockData();
analyticsData.sessions = mockData.sessions;
analyticsData.messages = mockData.messages;
analyticsData.toolCalls = mockData.toolCalls;

// GET /api/analytics - Get comprehensive analytics data
router.get('/', (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const now = Date.now();
    
    // Calculate time range
    let rangeMs;
    switch (range) {
      case '24h':
        rangeMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        rangeMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
      default:
        rangeMs = 30 * 24 * 60 * 60 * 1000;
        break;
    }
    
    const startTime = now - rangeMs;
    
    // Filter data by time range
    const filteredSessions = analyticsData.sessions.filter(s => s.startTime >= startTime);
    const filteredMessages = analyticsData.messages.filter(m => m.timestamp >= startTime);
    const filteredToolCalls = analyticsData.toolCalls.filter(t => t.timestamp >= startTime);
    
    // Calculate summary metrics
    const totalSessions = filteredSessions.length;
    const totalMessages = filteredMessages.length;
    const totalToolCalls = filteredToolCalls.length;
    const totalTokens = filteredSessions.reduce((sum, s) => sum + s.totalTokens, 0);
    const inputTokens = filteredSessions.reduce((sum, s) => sum + s.inputTokens, 0);
    const outputTokens = filteredSessions.reduce((sum, s) => sum + s.outputTokens, 0);
    
    // Cost estimates (using approximate rates)
    const costRates = {
      'claude-opus-4-6': { input: 5, output: 25 },
      'claude-sonnet-4-5': { input: 3, output: 15 },
      'claude-haiku-4-5': { input: 1, output: 5 },
      'gpt-4o': { input: 5, output: 15 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
    };
    
    let totalCost = 0;
    filteredSessions.forEach(session => {
      const rates = costRates[session.model] || costRates['claude-sonnet-4-5'];
      const inputCost = (session.inputTokens / 1000000) * rates.input;
      const outputCost = (session.outputTokens / 1000000) * rates.output;
      totalCost += inputCost + outputCost;
    });
    
    // Usage over time (daily buckets)
    const DAY = 24 * 60 * 60 * 1000;
    const usageOverTime = [];
    const daysInRange = Math.ceil(rangeMs / DAY);
    
    for (let i = daysInRange - 1; i >= 0; i--) {
      const dayStart = now - ((i + 1) * DAY);
      const dayEnd = now - (i * DAY);
      
      const daySessions = filteredSessions.filter(s => s.startTime >= dayStart && s.startTime < dayEnd);
      const dayMessages = filteredMessages.filter(m => m.timestamp >= dayStart && m.timestamp < dayEnd);
      const dayToolCalls = filteredToolCalls.filter(t => t.timestamp >= dayStart && t.timestamp < dayEnd);
      const dayTokens = daySessions.reduce((sum, s) => sum + s.totalTokens, 0);
      
      usageOverTime.push({
        date: new Date(dayStart).toISOString().split('T')[0],
        sessions: daySessions.length,
        messages: dayMessages.length,
        toolCalls: dayToolCalls.length,
        tokens: dayTokens,
      });
    }
    
    // Most used tools
    const toolCounts = {};
    filteredToolCalls.forEach(tc => {
      toolCounts[tc.tool] = (toolCounts[tc.tool] || 0) + 1;
    });
    const mostUsedTools = Object.entries(toolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Peak hours analysis
    const hourCounts = Array(24).fill(0);
    filteredMessages.forEach(m => {
      const hour = new Date(m.timestamp).getHours();
      hourCounts[hour]++;
    });
    const peakHours = hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      count,
    }));
    
    // Model distribution
    const modelCounts = {};
    filteredSessions.forEach(s => {
      modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
    });
    const modelDistribution = Object.entries(modelCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalSessions) * 100),
      }))
      .sort((a, b) => b.count - a.count);
    
    // Session leaderboard (top sessions by activity)
    const sessionLeaderboard = filteredSessions
      .map(s => ({
        id: s.id,
        date: new Date(s.startTime).toISOString(),
        duration: s.duration,
        messageCount: s.messageCount,
        tokenCount: s.totalTokens,
        model: s.model,
        toolCalls: filteredToolCalls.filter(tc => tc.sessionId === s.id).length,
      }))
      .sort((a, b) => b.tokenCount - a.tokenCount)
      .slice(0, 15);
    
    // Average metrics
    const avgSessionDuration = totalSessions > 0 
      ? Math.round(filteredSessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions)
      : 0;
    const avgMessagesPerSession = totalSessions > 0 
      ? Math.round(totalMessages / totalSessions)
      : 0;
    const avgTokensPerSession = totalSessions > 0 
      ? Math.round(totalTokens / totalSessions)
      : 0;
    
    res.json({
      summary: {
        totalSessions,
        totalMessages,
        totalToolCalls,
        totalTokens,
        inputTokens,
        outputTokens,
        estimatedCost: Math.round(totalCost * 100) / 100,
        avgSessionDuration,
        avgMessagesPerSession,
        avgTokensPerSession,
        timeRange: range,
      },
      usageOverTime,
      mostUsedTools,
      peakHours,
      modelDistribution,
      sessionLeaderboard,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

// POST /api/analytics/track - Track an event (for future real tracking)
router.post('/track', (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'Event type is required' });
    }
    
    // In production, this would store to a database
    console.log(`[Analytics] Event: ${event}`, data);
    
    res.json({ success: true, tracked: event });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track event', details: error.message });
  }
});

// GET /api/analytics/export - Export analytics data
router.get('/export', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const data = {
      exportedAt: new Date().toISOString(),
      sessions: analyticsData.sessions,
      messages: analyticsData.messages,
      toolCalls: analyticsData.toolCalls,
    };
    
    if (format === 'csv') {
      // Simple CSV export for sessions
      const csvHeader = 'id,startTime,endTime,duration,messageCount,model,totalTokens\n';
      const csvRows = data.sessions.map(s => 
        `${s.id},${new Date(s.startTime).toISOString()},${new Date(s.endTime).toISOString()},${s.duration},${s.messageCount},${s.model},${s.totalTokens}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
      res.send(csvHeader + csvRows);
    } else {
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to export analytics', details: error.message });
  }
});

export default router;
