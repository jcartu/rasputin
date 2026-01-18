import { z } from "zod";
import { Tool } from "./tool";
import { ClipboardTool } from "./clipboard";
import { NotificationTool } from "./notification";
import { ScreenshotTool } from "./screenshot";
import { OpenTool } from "./open";
import { SystemInfoTool } from "./system-info";
import { FsDialogTool } from "./fs-dialog";
import { ActiveWindowTool } from "./active-window";
import { KeystrokesTool } from "./keystrokes";

export namespace ToolRegistry {
  const tools: Map<string, Tool.Info> = new Map();

  export function init() {
    register(ClipboardTool);
    register(NotificationTool);
    register(ScreenshotTool);
    register(OpenTool);
    register(SystemInfoTool);
    register(FsDialogTool);
    register(ActiveWindowTool);
    register(KeystrokesTool);
  }

  export function register(tool: Tool.Info) {
    tools.set(tool.id, tool);
  }

  export function get(id: string): Tool.Info | undefined {
    return tools.get(id);
  }

  export function ids(): string[] {
    return Array.from(tools.keys());
  }

  export function all(): Tool.Info[] {
    return Array.from(tools.values());
  }

  export function definitions(): Array<{
    id: string;
    description: string;
    parameters: z.ZodType;
  }> {
    return all().map(t => ({
      id: t.id,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  export async function execute(
    toolId: string,
    args: unknown,
    ctx: Tool.Context
  ): Promise<Tool.Result> {
    const tool = get(toolId);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolId}`);
    }

    const parsed = tool.parameters.safeParse(args);
    if (!parsed.success) {
      throw new Error(
        `Invalid arguments for ${toolId}: ${parsed.error.message}`
      );
    }

    return tool.execute(parsed.data, ctx);
  }
}
