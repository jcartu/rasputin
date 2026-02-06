/**
 * Email AI Service - Smart features for email composition and analysis
 */
import config from '../config.js';
import { log } from './logger.js';
import * as openclawGateway from './openclawGateway.js';

/**
 * Generate smart reply suggestions for an email
 */
export async function generateSmartReplies(email, options = {}) {
  const { tone = 'professional', count = 3 } = options;

  const prompt = `You are an email assistant. Generate ${count} brief, ${tone} reply suggestions for this email.

From: ${email.from?.name || email.from?.email}
Subject: ${email.subject}
Content:
${email.body || email.snippet}

Generate ${count} different reply options, each 1-3 sentences. Format as JSON array:
[
  { "type": "positive", "text": "..." },
  { "type": "neutral", "text": "..." },
  { "type": "decline", "text": "..." }
]

Only output the JSON array, nothing else.`;

  try {
    // Use existing OpenClaw gateway for AI
    const response = await callAI(prompt);
    const suggestions = JSON.parse(response);
    return suggestions;
  } catch (error) {
    log.error('Failed to generate smart replies', { error: error.message });
    // Return fallback suggestions
    return [
      { type: 'positive', text: 'Thank you for your email. I will review this and get back to you shortly.' },
      { type: 'neutral', text: 'Thanks for reaching out. I have received your message.' },
      { type: 'decline', text: 'Thank you for your email. Unfortunately, I will not be able to assist with this at this time.' }
    ];
  }
}

/**
 * Summarize an email or email thread
 */
export async function summarizeEmail(emails, options = {}) {
  const { style = 'brief', includeActionItems = true } = options;

  const emailsText = Array.isArray(emails) 
    ? emails.map(e => `From: ${e.from?.name || e.from?.email}\nDate: ${e.date}\nSubject: ${e.subject}\n\n${e.body || e.snippet}`).join('\n\n---\n\n')
    : `From: ${emails.from?.name || emails.from?.email}\nDate: ${emails.date}\nSubject: ${emails.subject}\n\n${emails.body || emails.snippet}`;

  const prompt = `Summarize the following email${Array.isArray(emails) ? ' thread' : ''} in a ${style} way.
${includeActionItems ? 'Also list any action items or requests mentioned.' : ''}

${emailsText}

Format your response as JSON:
{
  "summary": "...",
  ${includeActionItems ? '"actionItems": ["...", "..."],' : ''}
  "keyPoints": ["...", "..."],
  "sentiment": "positive|neutral|negative"
}

Only output the JSON, nothing else.`;

  try {
    const response = await callAI(prompt);
    return JSON.parse(response);
  } catch (error) {
    log.error('Failed to summarize email', { error: error.message });
    return {
      summary: emails.snippet || 'Unable to generate summary',
      actionItems: [],
      keyPoints: [],
      sentiment: 'neutral'
    };
  }
}

/**
 * AI-assisted email composition
 */
export async function assistCompose(request) {
  const { 
    intent, // 'draft', 'improve', 'shorten', 'expand', 'formalize', 'casualize'
    content,
    context,
    tone = 'professional',
    language = 'en'
  } = request;

  let prompt;

  switch (intent) {
    case 'draft':
      prompt = `Write a ${tone} email based on this request:
${content}

${context ? `Context/Background:\n${context}` : ''}

Generate a complete email with subject line. Format as JSON:
{
  "subject": "...",
  "body": "..."
}`;
      break;

    case 'improve':
      prompt = `Improve this email while keeping the same intent. Make it clearer and more ${tone}:

${content}

Return the improved version as JSON:
{
  "subject": "...",
  "body": "...",
  "changes": ["list of changes made"]
}`;
      break;

    case 'shorten':
      prompt = `Shorten this email while keeping all key points. Be concise:

${content}

Return the shortened version as JSON:
{
  "body": "...",
  "reduction": "percentage reduced"
}`;
      break;

    case 'expand':
      prompt = `Expand this email with more detail and context:

${content}

Return the expanded version as JSON:
{
  "body": "..."
}`;
      break;

    case 'formalize':
      prompt = `Rewrite this email in a more formal, professional tone:

${content}

Return as JSON:
{
  "body": "..."
}`;
      break;

    case 'casualize':
      prompt = `Rewrite this email in a more casual, friendly tone:

${content}

Return as JSON:
{
  "body": "..."
}`;
      break;

    case 'translate':
      prompt = `Translate this email to ${language}:

${content}

Return as JSON:
{
  "subject": "...",
  "body": "..."
}`;
      break;

    default:
      throw new Error(`Unknown compose intent: ${intent}`);
  }

  prompt += '\n\nOnly output valid JSON, nothing else.';

  try {
    const response = await callAI(prompt);
    return JSON.parse(response);
  } catch (error) {
    log.error('AI compose assist failed', { error: error.message, intent });
    throw new Error('Failed to generate AI assistance');
  }
}

/**
 * Auto-complete email text
 */
export async function autocomplete(partialText, context = {}) {
  const { subject, recipient, previousEmails } = context;

  const prompt = `Complete this email text naturally and professionally. Only provide the completion, not the entire text.

${subject ? `Subject: ${subject}` : ''}
${recipient ? `To: ${recipient}` : ''}

Current text:
${partialText}

Provide a natural continuation (1-2 sentences). Only output the completion text, nothing else.`;

  try {
    const response = await callAI(prompt);
    return { completion: response.trim() };
  } catch (error) {
    log.error('Autocomplete failed', { error: error.message });
    return { completion: '' };
  }
}

/**
 * Analyze email for sentiment and priority
 */
export async function analyzeEmail(email) {
  const prompt = `Analyze this email for sentiment, priority, and category:

From: ${email.from?.name || email.from?.email}
Subject: ${email.subject}
Content:
${email.body || email.snippet}

Respond in JSON:
{
  "sentiment": "positive|neutral|negative",
  "priority": "high|medium|low",
  "category": "work|personal|marketing|notification|spam|other",
  "isUrgent": true|false,
  "requiresResponse": true|false,
  "suggestedDeadline": "ISO date or null"
}

Only output JSON.`;

  try {
    const response = await callAI(prompt);
    return JSON.parse(response);
  } catch (error) {
    log.error('Email analysis failed', { error: error.message });
    return {
      sentiment: 'neutral',
      priority: 'medium',
      category: 'other',
      isUrgent: false,
      requiresResponse: false,
      suggestedDeadline: null
    };
  }
}

/**
 * Extract action items from email
 */
export async function extractActionItems(email) {
  const prompt = `Extract all action items, tasks, and requests from this email:

From: ${email.from?.name || email.from?.email}
Subject: ${email.subject}
Content:
${email.body || email.snippet}

Respond in JSON:
{
  "actionItems": [
    {
      "task": "description",
      "assignee": "who should do it (me/sender/other)",
      "deadline": "mentioned deadline or null",
      "priority": "high|medium|low"
    }
  ]
}

Only output JSON.`;

  try {
    const response = await callAI(prompt);
    return JSON.parse(response);
  } catch (error) {
    log.error('Action item extraction failed', { error: error.message });
    return { actionItems: [] };
  }
}

/**
 * Convert email to chat session format
 */
export function convertToSession(email, options = {}) {
  const { includeThread = true } = options;

  const messages = [];

  // System message with context
  messages.push({
    role: 'system',
    content: `This conversation was converted from an email.
From: ${email.from?.name || email.from?.email} <${email.from?.email}>
Subject: ${email.subject}
Date: ${email.date}
${email.to?.length ? `To: ${email.to.map(t => t.email).join(', ')}` : ''}
${email.cc?.length ? `CC: ${email.cc.map(c => c.email).join(', ')}` : ''}`
  });

  // Email content as user message
  messages.push({
    role: 'user',
    content: email.body || email.htmlBody || email.snippet || '(Empty email)'
  });

  return {
    id: `email-${email.id}`,
    name: `Email: ${email.subject}`,
    messages,
    metadata: {
      source: 'email',
      emailId: email.id,
      threadId: email.threadId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      date: email.date
    },
    createdAt: email.date,
    updatedAt: new Date()
  };
}

/**
 * Helper to call AI (uses OpenClaw gateway or direct API)
 */
async function callAI(prompt) {
  // Try OpenClaw gateway first
  try {
    const gatewayStatus = await openclawGateway.getGatewayStatus();
    if (gatewayStatus.connected) {
      // Create temporary session for AI call
      const session = await openclawGateway.createSession(config.workspaceRoot);
      const response = await openclawGateway.sendMessage(session.id, prompt, {
        model: 'fast',
        maxTokens: 1000
      });
      await openclawGateway.deleteSession(session.id);
      return response.content || response.message || response;
    }
  } catch (error) {
    log.warn('OpenClaw gateway not available, using fallback', { error: error.message });
  }

  // Fallback to direct API call if configured
  if (config.openaiApiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI API call failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  throw new Error('No AI service available');
}

export default {
  generateSmartReplies,
  summarizeEmail,
  assistCompose,
  autocomplete,
  analyzeEmail,
  extractActionItems,
  convertToSession
};
