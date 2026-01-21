import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";

async function showOpenDialog(options?: {
  title?: string;
  directory?: boolean;
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string[]> {
  const platform = process.platform;

  if (platform === "darwin") {
    const scriptParts = [options?.directory ? "choose folder" : "choose file"];
    if (options?.title) {
      scriptParts.push(`with prompt "${options.title}"`);
    }
    if (options?.multiple) {
      scriptParts.push("with multiple selections allowed");
    }
    if (options?.filters && !options.directory) {
      const types = options.filters
        .flatMap(f => f.extensions)
        .map(e => `"${e}"`)
        .join(", ");
      scriptParts.push(`of type {${types}}`);
    }
    const script = scriptParts.join(" ");
    const result = await $`osascript -e ${script}`.text();
    return result
      .trim()
      .split(", ")
      .map(p => p.replace(/^alias /, "").replace(/:/g, "/"));
  } else if (platform === "win32") {
    const ps = options?.directory
      ? `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }`
      : `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Multiselect = $${options?.multiple ?? false}; if ($f.ShowDialog() -eq 'OK') { $f.FileNames -join '|' }`;
    const result = await $`powershell -command ${ps}`.text();
    return result.trim().split("|").filter(Boolean);
  } else {
    const args = ["--file-selection"];
    if (options?.title) args.push("--title", options.title);
    if (options?.directory) args.push("--directory");
    if (options?.multiple) args.push("--multiple");
    const result = await $`zenity ${args}`.text();
    return result.trim().split("|").filter(Boolean);
  }
}

async function showSaveDialog(options?: {
  title?: string;
  defaultName?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  const platform = process.platform;

  if (platform === "darwin") {
    const scriptParts = ["choose file name"];
    if (options?.title) {
      scriptParts.push(`with prompt "${options.title}"`);
    }
    if (options?.defaultName) {
      scriptParts.push(`default name "${options.defaultName}"`);
    }
    const script = scriptParts.join(" ");
    const result = await $`osascript -e ${script}`.text();
    return (
      result
        .trim()
        .replace(/^file /, "")
        .replace(/:/g, "/") || null
    );
  } else if (platform === "win32") {
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.SaveFileDialog; $f.FileName = "${options?.defaultName ?? ""}"; if ($f.ShowDialog() -eq 'OK') { $f.FileName }`;
    const result = await $`powershell -command ${ps}`.text();
    return result.trim() || null;
  } else {
    const args = ["--file-selection", "--save"];
    if (options?.title) args.push("--title", options.title);
    if (options?.defaultName) args.push("--filename", options.defaultName);
    const result = await $`zenity ${args}`.text();
    return result.trim() || null;
  }
}

export const FsDialogTool = Tool.define("desktop_fs_dialog", {
  description: `Show a file or folder selection dialog.
Use action="open" to let the user select files or folders.
Use action="save" to let the user choose a save location.
Returns the selected path(s).`,

  parameters: z.object({
    action: z.enum(["open", "save"]).describe("Type of dialog to show"),
    title: z.string().optional().describe("Dialog title"),
    directory: z
      .boolean()
      .optional()
      .default(false)
      .describe("Select directories instead of files (open only)"),
    multiple: z
      .boolean()
      .optional()
      .default(false)
      .describe("Allow multiple selections (open only)"),
    defaultName: z.string().optional().describe("Default filename (save only)"),
    filters: z
      .array(
        z.object({
          name: z.string(),
          extensions: z.array(z.string()),
        })
      )
      .optional()
      .describe("File type filters"),
  }),

  async execute(args, _ctx) {
    if (args.action === "open") {
      const paths = await showOpenDialog({
        title: args.title,
        directory: args.directory,
        multiple: args.multiple,
        filters: args.filters,
      });

      if (paths.length === 0) {
        return {
          output: "User cancelled selection",
          metadata: { cancelled: true },
        };
      }

      return {
        output: paths.join("\n"),
        metadata: { paths, count: paths.length },
      };
    } else {
      const path = await showSaveDialog({
        title: args.title,
        defaultName: args.defaultName,
        filters: args.filters,
      });

      if (!path) {
        return {
          output: "User cancelled selection",
          metadata: { cancelled: true },
        };
      }

      return {
        output: path,
        metadata: { path },
      };
    }
  },
});
