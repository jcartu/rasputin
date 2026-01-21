import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";

async function readClipboard(): Promise<string> {
  const platform = process.platform;

  if (platform === "darwin") {
    return await $`pbpaste`.text();
  } else if (platform === "win32") {
    return await $`powershell -command "Get-Clipboard"`.text();
  } else {
    try {
      return await $`xclip -selection clipboard -o`.text();
    } catch {
      return await $`xsel --clipboard --output`.text();
    }
  }
}

async function writeClipboard(content: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    await $`echo ${content} | pbcopy`;
  } else if (platform === "win32") {
    await $`powershell -command "Set-Clipboard -Value '${content}'"`;
  } else {
    try {
      await $`echo ${content} | xclip -selection clipboard`;
    } catch {
      await $`echo ${content} | xsel --clipboard --input`;
    }
  }
}

export const ClipboardTool = Tool.define("desktop_clipboard", {
  description: `Read or write the system clipboard.
Use action="read" to get current clipboard text content.
Use action="write" with content parameter to set clipboard content.`,

  parameters: z.object({
    action: z
      .enum(["read", "write"])
      .describe("Whether to read or write clipboard"),
    content: z
      .string()
      .optional()
      .describe("Content to write (required for write action)"),
  }),

  async execute(args, _ctx) {
    if (args.action === "read") {
      const content = await readClipboard();
      return {
        output: content.trim(),
        metadata: { length: content.length },
      };
    } else {
      if (!args.content) {
        throw new Error("Content is required for write action");
      }
      await writeClipboard(args.content);
      return {
        output: `Wrote ${args.content.length} characters to clipboard`,
        metadata: { length: args.content.length },
      };
    }
  },
});
