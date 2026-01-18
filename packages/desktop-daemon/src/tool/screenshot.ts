import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";

async function captureScreen(options?: {
  region?: { x: number; y: number; width: number; height: number };
  windowTitle?: string;
}): Promise<Buffer> {
  const platform = process.platform;
  const tmpFile = join(tmpdir(), `screenshot-${randomUUID()}.png`);

  try {
    if (platform === "darwin") {
      if (options?.windowTitle) {
        const script = `
          tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
          end tell
          tell application appName to activate
          delay 0.5
        `;
        await $`osascript -e ${script}`;
        await $`screencapture -w ${tmpFile}`;
      } else if (options?.region) {
        const { x, y, width, height } = options.region;
        await $`screencapture -R${x},${y},${width},${height} ${tmpFile}`;
      } else {
        await $`screencapture -x ${tmpFile}`;
      }
    } else if (platform === "win32") {
      if (options?.region) {
        const { x, y, width, height } = options.region;
        const ps = `
          Add-Type -AssemblyName System.Windows.Forms
          $bitmap = New-Object System.Drawing.Bitmap(${width}, ${height})
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen(${x}, ${y}, 0, 0, $bitmap.Size)
          $bitmap.Save("${tmpFile}")
        `;
        await $`powershell -command ${ps}`;
      } else {
        const ps = `
          Add-Type -AssemblyName System.Windows.Forms
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
          $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
          $bitmap.Save("${tmpFile}")
        `;
        await $`powershell -command ${ps}`;
      }
    } else {
      if (options?.region) {
        const { x, y, width, height } = options.region;
        await $`import -window root -crop ${width}x${height}+${x}+${y} ${tmpFile}`;
      } else {
        try {
          await $`gnome-screenshot -f ${tmpFile}`;
        } catch {
          await $`import -window root ${tmpFile}`;
        }
      }
    }

    const buffer = await readFile(tmpFile);
    await unlink(tmpFile);
    return buffer;
  } catch (error) {
    try {
      await unlink(tmpFile);
    } catch {}
    throw error;
  }
}

export const ScreenshotTool = Tool.define("desktop_screenshot", {
  description: `Capture a screenshot of the screen or a specific region.
Returns the image as a base64-encoded PNG attachment.
On macOS, requires screen recording permission.`,

  parameters: z.object({
    target: z
      .enum(["screen", "region"])
      .default("screen")
      .describe("What to capture: full screen or specific region"),
    region: z
      .object({
        x: z.number().describe("X coordinate of top-left corner"),
        y: z.number().describe("Y coordinate of top-left corner"),
        width: z.number().describe("Width in pixels"),
        height: z.number().describe("Height in pixels"),
      })
      .optional()
      .describe("Region coordinates (required if target is 'region')"),
  }),

  async execute(args, ctx) {
    if (args.target === "region" && !args.region) {
      throw new Error("Region coordinates required when target is 'region'");
    }

    const buffer = await captureScreen({
      region: args.region,
    });

    const base64 = buffer.toString("base64");

    return {
      output: `Screenshot captured (${buffer.length} bytes)`,
      metadata: {
        size: buffer.length,
        format: "png",
      },
      attachments: [
        {
          type: "image",
          name: "screenshot.png",
          data: base64,
          mimeType: "image/png",
        },
      ],
    };
  },
});
