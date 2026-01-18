import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";

async function openTarget(
  target: string,
  options?: { app?: string; background?: boolean }
): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    const args: string[] = [];
    if (options?.background) args.push("-g");
    if (options?.app) args.push("-a", options.app);
    args.push(target);
    await $`open ${args}`;
  } else if (platform === "win32") {
    if (options?.app) {
      await $`start "" ${options.app} ${target}`;
    } else {
      await $`start "" ${target}`;
    }
  } else {
    if (options?.app) {
      await $`${options.app} ${target}`;
    } else {
      await $`xdg-open ${target}`;
    }
  }
}

export const OpenTool = Tool.define("desktop_open", {
  description: `Open a URL, file, or application on the user's desktop.
Can open:
- URLs in the default browser
- Files with their default application
- Applications by name
Optionally specify which application to use.`,

  parameters: z.object({
    target: z.string().describe("URL, file path, or application name to open"),
    app: z
      .string()
      .optional()
      .describe("Specific application to use for opening"),
    background: z
      .boolean()
      .optional()
      .default(false)
      .describe("Open in background without focusing (macOS only)"),
  }),

  async execute(args, ctx) {
    await openTarget(args.target, {
      app: args.app,
      background: args.background,
    });

    const targetType = args.target.startsWith("http")
      ? "URL"
      : args.target.includes(".")
        ? "file"
        : "application";

    return {
      output: `Opened ${targetType}: ${args.target}${args.app ? ` with ${args.app}` : ""}`,
      metadata: {
        target: args.target,
        type: targetType,
        app: args.app,
      },
    };
  },
});
