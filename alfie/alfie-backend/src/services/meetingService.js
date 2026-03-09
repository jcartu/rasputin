import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';
import config from '../config.js';

const meetings = new Map();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export function createMeeting(data) {
  const meeting = {
    id: uuidv4(),
    title: data.title || 'Untitled Meeting',
    description: data.description,
    startTime: new Date().toISOString(),
    endTime: null,
    durationMs: 0,
    status: 'scheduled',
    speakers: data.speakers || [],
    transcript: [],
    summary: null,
    integration: data.integration || null,
    tags: data.tags || [],
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  meetings.set(meeting.id, meeting);
  log.info('Meeting created', { meetingId: meeting.id });
  return meeting;
}

export function getMeeting(id) {
  return meetings.get(id);
}

export function listMeetings(filter = {}) {
  let result = Array.from(meetings.values());
  
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    result = result.filter(m => 
      m.title.toLowerCase().includes(searchLower) ||
      m.description?.toLowerCase().includes(searchLower)
    );
  }
  
  if (filter.status?.length) {
    result = result.filter(m => filter.status.includes(m.status));
  }
  
  if (filter.isFavorite !== undefined) {
    result = result.filter(m => m.isFavorite === filter.isFavorite);
  }
  
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return result;
}

export function updateMeeting(id, updates) {
  const meeting = meetings.get(id);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  
  Object.assign(meeting, updates, { updatedAt: new Date().toISOString() });
  meetings.set(id, meeting);
  return meeting;
}

export function deleteMeeting(id) {
  const meeting = meetings.get(id);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  
  meetings.delete(id);
  log.info('Meeting deleted', { meetingId: id });
  return { success: true };
}

export function addTranscriptSegment(meetingId, segment) {
  const meeting = meetings.get(meetingId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  
  const newSegment = {
    id: uuidv4(),
    ...segment,
  };
  
  meeting.transcript.push(newSegment);
  meeting.updatedAt = new Date().toISOString();
  
  return newSegment;
}

export async function generateSummary(meetingId) {
  const meeting = meetings.get(meetingId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  
  if (meeting.transcript.length === 0) {
    throw new Error('No transcript available');
  }
  
  const transcriptText = meeting.transcript
    .map(seg => {
      const speaker = meeting.speakers.find(s => s.id === seg.speakerId);
      return `[${speaker?.name || 'Unknown'}]: ${seg.text}`;
    })
    .join('\n');
  
  const prompt = `Analyze this meeting transcript and provide a structured summary.

TRANSCRIPT:
${transcriptText}

Provide your response in the following JSON format:
{
  "overview": "A 2-3 sentence summary of the meeting",
  "keyPoints": [
    {"text": "key point text", "category": "decision|insight|question|followup|other"}
  ],
  "actionItems": [
    {"text": "action item text", "priority": "high|medium|low", "assignee": "name or null"}
  ],
  "decisions": ["decision 1", "decision 2"],
  "nextSteps": ["next step 1", "next step 2"],
  "participants": ["participant names mentioned"]
}

Be concise but comprehensive. Focus on actionable insights.`;

  try {
    if (!OPENROUTER_API_KEY) {
      return generateLocalSummary(meeting);
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse summary response');
    }
    
    const summaryData = JSON.parse(jsonMatch[0]);
    
    const summary = {
      overview: summaryData.overview || '',
      keyPoints: (summaryData.keyPoints || []).map(kp => ({
        id: uuidv4(),
        text: kp.text,
        category: kp.category || 'other',
        timestamp: 0,
      })),
      actionItems: (summaryData.actionItems || []).map(ai => ({
        id: uuidv4(),
        text: ai.text,
        assignee: ai.assignee || null,
        priority: ai.priority || 'medium',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })),
      decisions: summaryData.decisions || [],
      nextSteps: summaryData.nextSteps || [],
      participants: summaryData.participants || meeting.speakers.map(s => s.name),
      duration: meeting.durationMs,
      generatedAt: new Date().toISOString(),
    };
    
    meeting.summary = summary;
    meeting.updatedAt = new Date().toISOString();
    
    log.info('Meeting summary generated', { meetingId });
    return summary;
  } catch (error) {
    log.error('Summary generation failed', { meetingId, error: error.message });
    return generateLocalSummary(meeting);
  }
}

function generateLocalSummary(meeting) {
  const wordCount = meeting.transcript.reduce((sum, seg) => sum + seg.text.split(' ').length, 0);
  const uniqueSpeakers = new Set(meeting.transcript.map(seg => seg.speakerId));
  
  const summary = {
    overview: `Meeting "${meeting.title}" with ${uniqueSpeakers.size} participants. Approximately ${wordCount} words transcribed over ${Math.round(meeting.durationMs / 60000)} minutes.`,
    keyPoints: [],
    actionItems: [],
    decisions: [],
    nextSteps: [],
    participants: meeting.speakers.map(s => s.name),
    duration: meeting.durationMs,
    generatedAt: new Date().toISOString(),
  };
  
  meeting.summary = summary;
  meeting.updatedAt = new Date().toISOString();
  
  return summary;
}

export async function transcribeAudio(audioBuffer, options = {}) {
  const { model = 'base', language = 'en' } = options;
  
  const whisperEndpoint = process.env.WHISPER_API_ENDPOINT || 'http://localhost:9000/asr';
  
  try {
    const formData = new FormData();
    formData.append('audio_file', new Blob([audioBuffer]), 'audio.webm');
    formData.append('task', 'transcribe');
    formData.append('language', language);
    formData.append('output', 'json');
    
    const response = await fetch(whisperEndpoint, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return {
      text: result.text,
      segments: result.segments?.map(seg => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: seg.confidence || 0.9,
      })) || [],
    };
  } catch (error) {
    log.error('Whisper transcription failed', { error: error.message });
    throw error;
  }
}

export async function detectSpeakers(audioBuffer, options = {}) {
  const { maxSpeakers = 6 } = options;
  
  const diarizationEndpoint = process.env.DIARIZATION_API_ENDPOINT;
  
  if (!diarizationEndpoint) {
    return [];
  }
  
  try {
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer]), 'audio.webm');
    formData.append('max_speakers', maxSpeakers.toString());
    
    const response = await fetch(diarizationEndpoint, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Diarization API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return result.speakers || [];
  } catch (error) {
    log.error('Speaker diarization failed', { error: error.message });
    return [];
  }
}

export function getStats() {
  const allMeetings = Array.from(meetings.values());
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const totalDuration = allMeetings.reduce((sum, m) => sum + m.durationMs, 0);
  const meetingsThisWeek = allMeetings.filter(m => new Date(m.startTime) >= weekAgo).length;
  const meetingsThisMonth = allMeetings.filter(m => new Date(m.startTime) >= monthAgo).length;
  
  const speakerCounts = {};
  allMeetings.forEach(m => {
    m.speakers.forEach(s => {
      speakerCounts[s.name] = (speakerCounts[s.name] || 0) + 1;
    });
  });
  
  const topSpeakers = Object.entries(speakerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const tagCounts = {};
  allMeetings.forEach(m => {
    m.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalMeetings: allMeetings.length,
    totalDuration,
    averageDuration: allMeetings.length > 0 ? totalDuration / allMeetings.length : 0,
    meetingsThisWeek,
    meetingsThisMonth,
    topSpeakers,
    topTags,
  };
}
