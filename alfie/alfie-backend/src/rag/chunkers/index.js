import { ChunkingStrategy } from '../types.js';

export class TextChunker {
  constructor(config = {}) {
    this.strategy = config.strategy || ChunkingStrategy.RECURSIVE;
    this.chunkSize = config.chunkSize || 1000;
    this.chunkOverlap = config.chunkOverlap || 200;
    this.separators = config.separators || ['\n\n', '\n', '. ', ' '];
    this.keepSeparator = config.keepSeparator !== false;
    this.lengthFunction = config.lengthFunction || 'character';
  }

  chunk(text, metadata = {}) {
    const chunkers = {
      [ChunkingStrategy.FIXED_SIZE]: () => this.fixedSizeChunk(text),
      [ChunkingStrategy.RECURSIVE]: () => this.recursiveChunk(text),
      [ChunkingStrategy.SEMANTIC]: () => this.semanticChunk(text),
      [ChunkingStrategy.SENTENCE]: () => this.sentenceChunk(text),
      [ChunkingStrategy.PARAGRAPH]: () => this.paragraphChunk(text),
      [ChunkingStrategy.MARKDOWN_HEADER]: () => this.markdownHeaderChunk(text),
      [ChunkingStrategy.CODE_AWARE]: () => this.codeAwareChunk(text),
    };

    const chunker = chunkers[this.strategy];
    if (!chunker) {
      throw new Error(`Unknown chunking strategy: ${this.strategy}`);
    }

    const chunks = chunker();
    return chunks.map((content, index) => ({
      content,
      metadata: {
        ...metadata,
        chunkIndex: index,
        chunkCount: chunks.length,
        chunkSize: this.getLength(content),
        strategy: this.strategy,
      },
    }));
  }

  getLength(text) {
    if (this.lengthFunction === 'token') {
      return Math.ceil(text.length / 4);
    }
    return text.length;
  }

  fixedSizeChunk(text) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - this.chunkOverlap;
      if (start >= text.length - this.chunkOverlap) break;
    }

    return chunks;
  }

  recursiveChunk(text, separators = null) {
    const seps = separators || [...this.separators];
    
    if (this.getLength(text) <= this.chunkSize) {
      return [text.trim()].filter(Boolean);
    }

    if (seps.length === 0) {
      return this.fixedSizeChunk(text);
    }

    const separator = seps[0];
    const remainingSeps = seps.slice(1);
    const splits = this.splitWithSeparator(text, separator);
    
    const chunks = [];
    let currentChunk = '';

    for (const split of splits) {
      const potentialChunk = currentChunk + split;
      
      if (this.getLength(potentialChunk) <= this.chunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        
        if (this.getLength(split) > this.chunkSize) {
          const subChunks = this.recursiveChunk(split, remainingSeps);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = split;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return this.mergeSmallChunks(chunks);
  }

  splitWithSeparator(text, separator) {
    if (!separator) return [text];
    
    const splits = text.split(separator);
    if (!this.keepSeparator) return splits;
    
    return splits.map((s, i) => 
      i < splits.length - 1 ? s + separator : s
    );
  }

  mergeSmallChunks(chunks) {
    const merged = [];
    let current = '';

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      
      if (current && this.getLength(current + ' ' + chunk) <= this.chunkSize) {
        current = current + ' ' + chunk;
      } else {
        if (current) merged.push(current);
        current = chunk;
      }
    }

    if (current) merged.push(current);
    return merged;
  }

  sentenceChunk(text) {
    const sentencePattern = /[^.!?]+[.!?]+[\s]*/g;
    const sentences = text.match(sentencePattern) || [text];
    
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const potential = currentChunk + sentence;
      
      if (this.getLength(potential) <= this.chunkSize) {
        currentChunk = potential;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
  }

  paragraphChunk(text) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    const chunks = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      const potential = currentChunk ? currentChunk + '\n\n' + para : para;
      
      if (this.getLength(potential) <= this.chunkSize) {
        currentChunk = potential;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        
        if (this.getLength(para) > this.chunkSize) {
          chunks.push(...this.recursiveChunk(para));
          currentChunk = '';
        } else {
          currentChunk = para;
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  semanticChunk(text) {
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
    
    const groups = [];
    let currentGroup = [];
    let currentLength = 0;

    for (const sentence of sentences) {
      const sentenceLength = this.getLength(sentence);
      
      if (currentLength + sentenceLength > this.chunkSize && currentGroup.length > 0) {
        groups.push(currentGroup);
        
        const overlapStart = Math.max(0, currentGroup.length - 2);
        currentGroup = currentGroup.slice(overlapStart);
        currentLength = currentGroup.reduce((sum, s) => sum + this.getLength(s), 0);
      }
      
      currentGroup.push(sentence);
      currentLength += sentenceLength;
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups.map(group => group.join('').trim());
  }

  markdownHeaderChunk(text) {
    const headerPattern = /^(#{1,6})\s+(.+)$/gm;
    const sections = [];
    let lastIndex = 0;
    let currentSection = { level: 0, title: '', content: '' };
    
    const matches = [...text.matchAll(headerPattern)];
    for (const match of matches) {
      if (lastIndex > 0 || match.index > 0) {
        currentSection.content = text.slice(lastIndex, match.index).trim();
        if (currentSection.content || currentSection.title) {
          sections.push({ ...currentSection });
        }
      }

      currentSection = {
        level: match[1].length,
        title: match[2],
        content: '',
      };
      lastIndex = match.index + match[0].length;
    }

    currentSection.content = text.slice(lastIndex).trim();
    if (currentSection.content || currentSection.title) {
      sections.push(currentSection);
    }

    return sections.map(section => {
      const header = section.title ? `${'#'.repeat(section.level)} ${section.title}\n\n` : '';
      const fullContent = header + section.content;
      
      if (this.getLength(fullContent) > this.chunkSize) {
        return this.recursiveChunk(fullContent);
      }
      return [fullContent];
    }).flat();
  }

  codeAwareChunk(text) {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const parts = [];
    let lastIndex = 0;
    
    const matches = [...text.matchAll(codeBlockPattern)];
    for (const match of matches) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', content: match[0] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    const chunks = [];
    for (const part of parts) {
      if (part.type === 'code') {
        if (this.getLength(part.content) > this.chunkSize) {
          const lines = part.content.split('\n');
          const langMatch = lines[0].match(/```(\w+)?/);
          const lang = langMatch ? langMatch[1] || '' : '';
          const codeLines = lines.slice(1, -1);
          
          let currentChunk = [];
          for (const line of codeLines) {
            currentChunk.push(line);
            const chunkContent = '```' + lang + '\n' + currentChunk.join('\n') + '\n```';
            
            if (this.getLength(chunkContent) > this.chunkSize && currentChunk.length > 1) {
              currentChunk.pop();
              chunks.push('```' + lang + '\n' + currentChunk.join('\n') + '\n```');
              currentChunk = [line];
            }
          }
          
          if (currentChunk.length > 0) {
            chunks.push('```' + lang + '\n' + currentChunk.join('\n') + '\n```');
          }
        } else {
          chunks.push(part.content);
        }
      } else {
        chunks.push(...this.recursiveChunk(part.content));
      }
    }

    return chunks.filter(c => c.trim());
  }
}

export function createChunker(config = {}) {
  return new TextChunker(config);
}

export default { TextChunker, createChunker };
