import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function queryMemories(message) {
  try {
    const safeMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$').slice(0, 500);
    const { stdout } = await execAsync(
      `python3 /home/josh/.openclaw/workspace/alfie_second_brain.py "${safeMessage}"`,
      { timeout: 10000 }
    );
    const results = JSON.parse(stdout);
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

export async function enrichWithMemories(message) {
  try {
    const memories = await queryMemories(message);
    if (memories.length === 0) return message;
    
    const context = memories.map((m, i) => 
      `[Memory ${i+1}] ${m.text} (score: ${m.score})`
    ).join('\n');
    
    return `Context from memories:\n${context}\n\nUser message: ${message}`;
  } catch {
    return message;
  }
}

export default { queryMemories, enrichWithMemories };
