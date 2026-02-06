import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function queryMemories(message) {
  try {
    const { stdout } = await execAsync(
      `python3 /home/josh/.openclaw/workspace/alfie_second_brain.py "${message.replace(/"/g, '\\"')}"`
    );
    const results = JSON.parse(stdout);
    return results.slice(0, 5); // Top 5 memories
  } catch (error) {
    console.error('Second brain error:', error);
    return [];
  }
}

export async function enrichWithMemories(message) {
  const memories = await queryMemories(message);
  if (memories.length === 0) return message;
  
  const context = memories.map((m, i) => 
    `[Memory ${i+1}] ${m.text} (score: ${m.score})`
  ).join('\n');
  
  return `Context from 438K memories:\n${context}\n\nUser message: ${message}`;
}

export default { queryMemories, enrichWithMemories };
