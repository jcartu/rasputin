/**
 * Universal Search Service
 * Full-text search across sessions, messages, files, and second brain (438K memories)
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import * as sessionManager from './sessionManager.js';
import config from '../config.js';

const execAsync = promisify(exec);

// Search result types
const RESULT_TYPES = {
  SESSION: 'session',
  MESSAGE: 'message',
  FILE: 'file',
  MEMORY: 'memory',
};

/**
 * Fuzzy match scoring - returns score 0-1
 */
function fuzzyScore(query, text) {
  if (!query || !text) return 0;
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) {
    return 1.0;
  }
  
  // Word-level matching
  const queryWords = queryLower.split(/\s+/);
  const textWords = textLower.split(/\s+/);
  
  let matchedWords = 0;
  for (const qWord of queryWords) {
    if (textWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))) {
      matchedWords++;
    }
  }
  
  if (matchedWords === 0) return 0;
  return matchedWords / queryWords.length;
}

/**
 * Highlight matching text with markers
 */
function highlightMatches(text, query, maxLength = 200) {
  if (!text || !query) return text;
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const idx = textLower.indexOf(queryLower);
  
  if (idx === -1) {
    // Try word-level highlight
    const words = query.toLowerCase().split(/\s+/);
    let result = text;
    for (const word of words) {
      const regex = new RegExp(`(${word})`, 'gi');
      result = result.replace(regex, '<<$1>>');
    }
    // Truncate around first highlight
    const highlightIdx = result.indexOf('<<');
    if (highlightIdx > maxLength / 2) {
      result = '...' + result.substring(highlightIdx - 50);
    }
    if (result.length > maxLength) {
      result = result.substring(0, maxLength) + '...';
    }
    return result;
  }
  
  // Exact match found - show context around it
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + query.length + 100);
  
  let excerpt = text.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  
  // Add highlight markers
  const highlightedQuery = '<<' + query + '>>';
  excerpt = excerpt.replace(new RegExp(query, 'gi'), highlightedQuery);
  
  return excerpt;
}

/**
 * Search sessions by name and metadata
 */
function searchSessions(query, options = {}) {
  const { limit = 10 } = options;
  const sessions = sessionManager.listLocalSessions();
  const results = [];
  
  for (const session of sessions) {
    const nameScore = fuzzyScore(query, session.metadata?.name || '');
    const projectScore = fuzzyScore(query, session.metadata?.projectPath || '');
    const score = Math.max(nameScore, projectScore);
    
    if (score > 0.3) {
      results.push({
        type: RESULT_TYPES.SESSION,
        id: session.localId,
        title: session.metadata?.name || `Session ${session.localId.slice(0, 8)}`,
        subtitle: session.metadata?.projectPath || '',
        excerpt: `Created: ${session.createdAt} | Messages: ${session.messages.length}`,
        score,
        timestamp: session.lastActivity,
        data: {
          sessionId: session.localId,
          gatewaySessionId: session.gatewaySessionId,
        },
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search messages within sessions
 */
function searchMessages(query, options = {}) {
  const { limit = 20, sessionId = null } = options;
  const sessions = sessionId 
    ? [sessionManager.getLocalSession(sessionId)].filter(Boolean)
    : sessionManager.listLocalSessions();
  
  const results = [];
  
  for (const session of sessions) {
    for (const message of session.messages || []) {
      const score = fuzzyScore(query, message.content);
      
      if (score > 0.2) {
        results.push({
          type: RESULT_TYPES.MESSAGE,
          id: message.id,
          title: `${message.role === 'user' ? 'You' : 'Assistant'}`,
          subtitle: session.metadata?.name || `Session ${session.localId.slice(0, 8)}`,
          excerpt: highlightMatches(message.content, query),
          score,
          timestamp: message.timestamp,
          data: {
            sessionId: session.localId,
            messageId: message.id,
            role: message.role,
          },
        });
      }
    }
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search files by name and content
 */
async function searchFiles(query, options = {}) {
  const { limit = 20, searchContent = true } = options;
  const workspaceRoot = options.path || config.workspaceRoot;
  const results = [];
  
  try {
    // Search file names using find
    const { stdout: findOutput } = await execAsync(
      `find "${workspaceRoot}" -type f -name "*${query}*" 2>/dev/null | head -50`,
      { timeout: 5000 }
    );
    
    const matchedFiles = findOutput.trim().split('\n').filter(Boolean);
    
    for (const filePath of matchedFiles) {
      const relativePath = path.relative(workspaceRoot, filePath);
      const fileName = path.basename(filePath);
      
      results.push({
        type: RESULT_TYPES.FILE,
        id: `file:${relativePath}`,
        title: fileName,
        subtitle: path.dirname(relativePath),
        excerpt: relativePath,
        score: fuzzyScore(query, fileName),
        timestamp: null,
        data: {
          path: filePath,
          relativePath,
          matchType: 'filename',
        },
      });
    }
    
    // Search file contents using grep (limited to text files)
    if (searchContent) {
      try {
        const { stdout: grepOutput } = await execAsync(
          `grep -ril --include="*.{js,ts,tsx,jsx,json,md,txt,py,html,css,yaml,yml}" "${query}" "${workspaceRoot}" 2>/dev/null | head -30`,
          { timeout: 10000 }
        );
        
        const contentMatchFiles = grepOutput.trim().split('\n').filter(Boolean);
        
        for (const filePath of contentMatchFiles) {
          // Skip if already in results
          const relativePath = path.relative(workspaceRoot, filePath);
          if (results.some(r => r.data?.relativePath === relativePath)) continue;
          
          // Get matching line excerpt
          try {
            const { stdout: matchLine } = await execAsync(
              `grep -i -m 1 "${query}" "${filePath}" 2>/dev/null`,
              { timeout: 2000 }
            );
            
            results.push({
              type: RESULT_TYPES.FILE,
              id: `file:content:${relativePath}`,
              title: path.basename(filePath),
              subtitle: path.dirname(relativePath),
              excerpt: highlightMatches(matchLine.trim(), query),
              score: 0.7, // Content match score
              timestamp: null,
              data: {
                path: filePath,
                relativePath,
                matchType: 'content',
              },
            });
          } catch {
            // Skip files that can't be read
          }
        }
      } catch {
        // grep errors are not fatal
      }
    }
  } catch (error) {
    console.error('File search error:', error.message);
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search second brain (438K memories) using semantic search
 */
async function searchMemories(query, options = {}) {
  const { limit = 10, scoreThreshold = 0.5 } = options;
  
  try {
    const { stdout } = await execAsync(
      `python3 /home/josh/.openclaw/workspace/alfie_second_brain.py "${query.replace(/"/g, '\\"')}"`,
      { timeout: 15000 }
    );
    
    // Parse the formatted output
    const lines = stdout.trim().split('\n');
    const results = [];
    
    for (const line of lines) {
      // Skip header
      if (line.startsWith('##') || !line.trim()) continue;
      
      // Parse format: [date] source 'title' - sender: text... (relevance: 0.xx)
      const relevanceMatch = line.match(/\(relevance: ([\d.]+)\)/);
      const score = relevanceMatch ? parseFloat(relevanceMatch[1]) : 0.5;
      
      if (score < scoreThreshold) continue;
      
      // Extract date if present
      const dateMatch = line.match(/\[([^\]]+)\]/);
      const date = dateMatch ? dateMatch[1] : null;
      
      // Clean up the text
      const text = line
        .replace(/\(relevance: [\d.]+\)/, '')
        .replace(/\[[^\]]+\]/, '')
        .trim();
      
      // Extract source/title
      const sourceMatch = text.match(/^([^:]+):/);
      const source = sourceMatch ? sourceMatch[1].trim() : 'Memory';
      const content = sourceMatch ? text.substring(sourceMatch[0].length).trim() : text;
      
      results.push({
        type: RESULT_TYPES.MEMORY,
        id: `memory:${Date.now()}-${results.length}`,
        title: source.slice(0, 60),
        subtitle: date || 'Second Brain',
        excerpt: highlightMatches(content, query, 250),
        score,
        timestamp: date,
        data: {
          source,
          date,
          fullText: content,
        },
      });
    }
    
    return results.slice(0, limit);
  } catch (error) {
    console.error('Memory search error:', error.message);
    return [];
  }
}

/**
 * Universal search - searches all sources
 */
export async function search(query, options = {}) {
  const {
    types = ['session', 'message', 'file', 'memory'],
    limit = 50,
    sessionId = null,
    path: searchPath = null,
  } = options;
  
  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, query };
  }
  
  const searchPromises = [];
  const typeConfig = {
    session: () => Promise.resolve(searchSessions(query, { limit: 10 })),
    message: () => Promise.resolve(searchMessages(query, { limit: 20, sessionId })),
    file: () => searchFiles(query, { limit: 15, path: searchPath }),
    memory: () => searchMemories(query, { limit: 15 }),
  };
  
  for (const type of types) {
    if (typeConfig[type]) {
      searchPromises.push(
        typeConfig[type]().catch(err => {
          console.error(`Search error for ${type}:`, err.message);
          return [];
        })
      );
    }
  }
  
  const searchResults = await Promise.all(searchPromises);
  
  // Combine and sort all results
  const allResults = searchResults
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return {
    results: allResults,
    total: allResults.length,
    query,
    types,
  };
}

/**
 * Quick search - optimized for command palette (instant results)
 */
export async function quickSearch(query, options = {}) {
  const { limit = 10 } = options;
  
  if (!query || query.trim().length < 2) {
    return { results: [], query };
  }
  
  // Only search fast sources for instant results
  const [sessions, messages] = await Promise.all([
    searchSessions(query, { limit: 5 }),
    searchMessages(query, { limit: 5 }),
  ]);
  
  const results = [...sessions, ...messages]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return { results, query };
}

/**
 * Deep search - thorough search including second brain
 */
export async function deepSearch(query, options = {}) {
  return search(query, { 
    ...options, 
    types: ['session', 'message', 'file', 'memory'],
    limit: 100,
  });
}

export default {
  search,
  quickSearch,
  deepSearch,
  searchSessions,
  searchMessages,
  searchFiles,
  searchMemories,
  RESULT_TYPES,
};
