import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";

async function sendKeystrokes(
  keys: string,
  options?: { delay?: number }
): Promise<void> {
  const platform = process.platform;
  const delay = options?.delay ?? 50;

  if (platform === "darwin") {
    const script = `
      tell application "System Events"
        keystroke "${keys.replace(/"/g, '\\"')}"
      end tell
    `;
    await $`osascript -e ${script}`;
  } else if (platform === "win32") {
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${keys.replace(/"/g, '`"')}")
    `;
    await $`powershell -command ${ps}`;
  } else {
    await $`xdotool type --delay ${delay} ${keys}`;
  }
}

async function sendKey(key: string, modifiers?: string[]): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    const mods = modifiers
      ?.map(m => {
        switch (m.toLowerCase()) {
          case "cmd":
          case "command":
            return "command down";
          case "ctrl":
          case "control":
            return "control down";
          case "alt":
          case "option":
            return "option down";
          case "shift":
            return "shift down";
          default:
            return "";
        }
      })
      .filter(Boolean)
      .join(", ");

    const script = mods
      ? `tell application "System Events" to key code ${getKeyCode(key)} using {${mods}}`
      : `tell application "System Events" to key code ${getKeyCode(key)}`;
    await $`osascript -e ${script}`;
  } else if (platform === "win32") {
    const modMap: Record<string, string> = {
      cmd: "^",
      command: "^",
      ctrl: "^",
      control: "^",
      alt: "%",
      shift: "+",
    };
    const modStr =
      modifiers?.map(m => modMap[m.toLowerCase()] || "").join("") || "";
    const keyMap: Record<string, string> = {
      enter: "{ENTER}",
      tab: "{TAB}",
      escape: "{ESC}",
      backspace: "{BACKSPACE}",
      delete: "{DELETE}",
      up: "{UP}",
      down: "{DOWN}",
      left: "{LEFT}",
      right: "{RIGHT}",
      home: "{HOME}",
      end: "{END}",
      pageup: "{PGUP}",
      pagedown: "{PGDN}",
    };
    const keyStr = keyMap[key.toLowerCase()] || key;
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("${modStr}${keyStr}")
    `;
    await $`powershell -command ${ps}`;
  } else {
    const modStr = modifiers?.join("+") || "";
    const fullKey = modStr ? `${modStr}+${key}` : key;
    await $`xdotool key ${fullKey}`;
  }
}

function getKeyCode(key: string): number {
  const keyCodes: Record<string, number> = {
    a: 0,
    s: 1,
    d: 2,
    f: 3,
    h: 4,
    g: 5,
    z: 6,
    x: 7,
    c: 8,
    v: 9,
    b: 11,
    q: 12,
    w: 13,
    e: 14,
    r: 15,
    y: 16,
    t: 17,
    "1": 18,
    "2": 19,
    "3": 20,
    "4": 21,
    "6": 22,
    "5": 23,
    "=": 24,
    "9": 25,
    "7": 26,
    "-": 27,
    "8": 28,
    "0": 29,
    "]": 30,
    o: 31,
    u: 32,
    "[": 33,
    i: 34,
    p: 35,
    enter: 36,
    l: 37,
    j: 38,
    "'": 39,
    k: 40,
    ";": 41,
    "\\": 42,
    ",": 43,
    "/": 44,
    n: 45,
    m: 46,
    ".": 47,
    tab: 48,
    space: 49,
    "`": 50,
    backspace: 51,
    escape: 53,
    delete: 117,
    up: 126,
    down: 125,
    left: 123,
    right: 124,
    home: 115,
    end: 119,
    pageup: 116,
    pagedown: 121,
  };
  return keyCodes[key.toLowerCase()] ?? 0;
}

export const KeystrokesTool = Tool.define("desktop_keystrokes", {
  description: `Send keystrokes or key combinations to the active application.
Use action="type" to type text.
Use action="key" to send a single key with optional modifiers (ctrl, alt, shift, cmd).
WARNING: This tool can automate keyboard input. Use with caution.`,

  parameters: z.object({
    action: z
      .enum(["type", "key"])
      .describe("Whether to type text or send a key"),
    text: z.string().optional().describe("Text to type (for action='type')"),
    key: z.string().optional().describe("Key to press (for action='key')"),
    modifiers: z
      .array(
        z.enum(["ctrl", "alt", "shift", "cmd", "command", "control", "option"])
      )
      .optional()
      .describe("Modifier keys to hold"),
    delay: z
      .number()
      .optional()
      .default(50)
      .describe("Delay between keystrokes in ms"),
  }),

  async execute(args, _ctx) {
    if (args.action === "type") {
      if (!args.text) {
        throw new Error("Text is required for type action");
      }
      await sendKeystrokes(args.text, { delay: args.delay });
      return {
        output: `Typed ${args.text.length} characters`,
        metadata: { length: args.text.length },
      };
    } else {
      if (!args.key) {
        throw new Error("Key is required for key action");
      }
      await sendKey(args.key, args.modifiers);
      const keyDesc = args.modifiers?.length
        ? `${args.modifiers.join("+")}+${args.key}`
        : args.key;
      return {
        output: `Sent key: ${keyDesc}`,
        metadata: { key: args.key, modifiers: args.modifiers },
      };
    }
  },
});
