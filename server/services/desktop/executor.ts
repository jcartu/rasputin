import { spawn } from "child_process";
import { nanoid } from "nanoid";
import type {
  Action,
  ActionRequest,
  ActionResponse,
  ActionBatch,
  ActionBatchResponse,
  ClickAction,
  TypeAction,
  KeyAction,
  ScrollAction,
  MoveAction,
  DragAction,
  ScreenshotAction,
  WaitAction,
  WindowAction,
  LaunchAction,
  ClipboardAction,
  AssertAction,
} from "./actionDSL";
import { getDb } from "../../db";
import { actionDSLLog } from "../../../drizzle/schema";

const XDOTOOL_PATH = "xdotool";
const SCROT_PATH = "scrot";
const XCLIP_PATH = "xclip";
const SCREENSHOT_DIR = "/tmp/jarvis-screenshots";

async function ensureScreenshotDir(): Promise<void> {
  const { mkdir } = await import("fs/promises");
  await mkdir(SCREENSHOT_DIR, { recursive: true });
}

async function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number = 10000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { timeout: timeoutMs });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", data => {
      stdout += data.toString();
    });
    proc.stderr.on("data", data => {
      stderr += data.toString();
    });

    proc.on("close", code => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
      });
    });
    proc.on("error", err => {
      reject(err);
    });
  });
}

async function executeClick(action: ClickAction): Promise<unknown> {
  const args: string[] = [];

  if (action.modifiers.length > 0) {
    args.push("keydown", ...action.modifiers);
  }

  if (action.point) {
    args.push("mousemove", String(action.point.x), String(action.point.y));
  } else if (action.target) {
    throw new Error(
      "Vision-based click not implemented yet. Provide coordinates."
    );
  }

  const clickCmd = action.double ? "click --repeat 2" : "click";
  const button =
    action.button === "left" ? "1" : action.button === "right" ? "3" : "2";
  args.push(clickCmd, button);

  if (action.modifiers.length > 0) {
    args.push("keyup", ...action.modifiers);
  }

  const result = await runCommand(XDOTOOL_PATH, args);
  if (result.exitCode !== 0) {
    throw new Error(`Click failed: ${result.stderr}`);
  }
  return { clicked: true, point: action.point };
}

async function executeType(action: TypeAction): Promise<unknown> {
  if (action.clear) {
    await runCommand(XDOTOOL_PATH, ["key", "ctrl+a", "Delete"]);
  }

  const args = action.charByChar
    ? ["type", "--delay", String(action.charDelayMs), action.text]
    : ["type", "--clearmodifiers", action.text];

  const result = await runCommand(XDOTOOL_PATH, args);
  if (result.exitCode !== 0) {
    throw new Error(`Type failed: ${result.stderr}`);
  }

  if (action.submit) {
    await runCommand(XDOTOOL_PATH, ["key", "Return"]);
  }

  return { typed: action.text.length, submitted: action.submit };
}

async function executeKey(action: KeyAction): Promise<unknown> {
  const keySpec =
    action.modifiers.length > 0
      ? [...action.modifiers, action.key].join("+")
      : action.key;

  const cmd = action.hold ? "keydown" : action.release ? "keyup" : "key";
  const result = await runCommand(XDOTOOL_PATH, [cmd, keySpec]);
  if (result.exitCode !== 0) {
    throw new Error(`Key press failed: ${result.stderr}`);
  }
  return { key: keySpec, action: cmd };
}

async function executeScroll(action: ScrollAction): Promise<unknown> {
  const args: string[] = [];

  if (action.point) {
    args.push("mousemove", String(action.point.x), String(action.point.y));
  }

  const amount = action.amount === "page" ? 10 : Math.ceil(action.amount / 30);
  const button =
    action.direction === "up" || action.direction === "left" ? 4 : 5;

  for (let i = 0; i < amount; i++) {
    args.push("click", String(button));
  }

  const result = await runCommand(XDOTOOL_PATH, args);
  if (result.exitCode !== 0) {
    throw new Error(`Scroll failed: ${result.stderr}`);
  }
  return { direction: action.direction, amount: action.amount };
}

async function executeMove(action: MoveAction): Promise<unknown> {
  const args = ["mousemove"];
  if (!action.smooth) {
    args.push("--sync");
  }
  args.push(String(action.point.x), String(action.point.y));

  const result = await runCommand(XDOTOOL_PATH, args);
  if (result.exitCode !== 0) {
    throw new Error(`Move failed: ${result.stderr}`);
  }
  return { movedTo: action.point };
}

async function executeDrag(action: DragAction): Promise<unknown> {
  const button =
    action.button === "left" ? "1" : action.button === "right" ? "3" : "2";
  const steps = Math.ceil(action.durationMs / 50);
  const dx = (action.to.x - action.from.x) / steps;
  const dy = (action.to.y - action.from.y) / steps;

  await runCommand(XDOTOOL_PATH, [
    "mousemove",
    String(action.from.x),
    String(action.from.y),
  ]);
  await runCommand(XDOTOOL_PATH, ["mousedown", button]);

  for (let i = 1; i <= steps; i++) {
    const x = Math.round(action.from.x + dx * i);
    const y = Math.round(action.from.y + dy * i);
    await runCommand(XDOTOOL_PATH, ["mousemove", String(x), String(y)]);
    await new Promise(r => setTimeout(r, 50));
  }

  await runCommand(XDOTOOL_PATH, ["mouseup", button]);
  return { from: action.from, to: action.to };
}

async function executeScreenshot(
  action: ScreenshotAction
): Promise<{ screenshotPath: string }> {
  await ensureScreenshotDir();
  const filename = `${SCREENSHOT_DIR}/ss-${nanoid()}.${action.format}`;

  const args: string[] = [];
  if (action.region) {
    const { x, y, width, height } = action.region;
    args.push("-a", `${x},${y},${width},${height}`);
  }
  if (action.format === "jpeg" || action.format === "webp") {
    args.push("-q", String(action.quality));
  }
  args.push(filename);

  const result = await runCommand(SCROT_PATH, args);
  if (result.exitCode !== 0) {
    throw new Error(`Screenshot failed: ${result.stderr}`);
  }
  return { screenshotPath: filename };
}

async function executeWait(action: WaitAction): Promise<unknown> {
  if (action.waitFor === "duration" && action.durationMs) {
    await new Promise(r => setTimeout(r, action.durationMs));
    return { waited: action.durationMs };
  }

  if (action.waitFor === "idle") {
    await new Promise(r => setTimeout(r, 1000));
    return { waited: "idle" };
  }

  if (action.waitFor === "element" && action.element) {
    throw new Error(
      "Element wait requires vision system - not implemented yet"
    );
  }

  return { waited: "unknown" };
}

async function executeWindow(action: WindowAction): Promise<unknown> {
  let windowId: string | undefined;

  if (action.window) {
    const searchResult = await runCommand(XDOTOOL_PATH, [
      "search",
      "--name",
      action.window,
    ]);
    const ids = searchResult.stdout.split("\n").filter(Boolean);
    if (ids.length === 0) {
      throw new Error(`Window not found: ${action.window}`);
    }
    windowId = ids[0];
  }

  const cmdMap: Record<string, string[]> = {
    focus: windowId
      ? ["windowactivate", windowId]
      : ["windowactivate", "$(xdotool getactivewindow)"],
    minimize: windowId
      ? ["windowminimize", windowId]
      : ["windowminimize", "$(xdotool getactivewindow)"],
    maximize: ["key", "super+Up"],
    restore: ["key", "super+Down"],
    close: ["key", "alt+F4"],
    move:
      windowId && action.position
        ? [
            "windowmove",
            windowId,
            String(action.position.x),
            String(action.position.y),
          ]
        : [],
    resize:
      windowId && action.size
        ? [
            "windowsize",
            windowId,
            String(action.size.width),
            String(action.size.height),
          ]
        : [],
  };

  const args = cmdMap[action.operation];
  if (!args || args.length === 0) {
    throw new Error(
      `Window operation ${action.operation} requires more parameters`
    );
  }

  const result = await runCommand(XDOTOOL_PATH, args);
  if (result.exitCode !== 0) {
    throw new Error(`Window ${action.operation} failed: ${result.stderr}`);
  }
  return { operation: action.operation, window: action.window || "active" };
}

async function executeLaunch(action: LaunchAction): Promise<unknown> {
  const proc = spawn(action.app, action.args, {
    cwd: action.cwd,
    detached: true,
    stdio: "ignore",
  });
  proc.unref();

  if (action.waitForWindow) {
    const start = Date.now();
    while (Date.now() - start < action.timeoutMs) {
      const searchResult = await runCommand(XDOTOOL_PATH, [
        "search",
        "--name",
        action.app,
      ]);
      if (searchResult.stdout.trim()) {
        return { launched: action.app, windowFound: true };
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return { launched: action.app, windowFound: false, timedOut: true };
  }

  return { launched: action.app };
}

async function executeClipboard(action: ClipboardAction): Promise<unknown> {
  switch (action.operation) {
    case "copy":
      await runCommand(XDOTOOL_PATH, ["key", "ctrl+c"]);
      return { operation: "copy" };

    case "paste":
      await runCommand(XDOTOOL_PATH, ["key", "ctrl+v"]);
      return { operation: "paste" };

    case "set":
      if (!action.text) throw new Error("Text required for set operation");
      await runCommand("sh", [
        "-c",
        `echo -n "${action.text.replace(/"/g, '\\"')}" | ${XCLIP_PATH} -selection clipboard`,
      ]);
      return { operation: "set", length: action.text.length };

    case "get": {
      const result = await runCommand(XCLIP_PATH, [
        "-selection",
        "clipboard",
        "-o",
      ]);
      return { operation: "get", text: result.stdout };
    }

    default:
      throw new Error(`Unknown clipboard operation: ${action.operation}`);
  }
}

async function executeAssert(action: AssertAction): Promise<unknown> {
  switch (action.assertType) {
    case "element_visible":
    case "element_not_visible":
    case "text_present":
    case "text_not_present":
      throw new Error(
        `Assert type ${action.assertType} requires vision system - not implemented yet`
      );

    case "color_at_point":
      if (!action.point || !action.color) {
        throw new Error("Point and color required for color_at_point assert");
      }
      throw new Error("Color assertion not implemented yet");

    default:
      throw new Error(`Unknown assert type: ${action.assertType}`);
  }
}

async function executeAction(action: Action): Promise<unknown> {
  switch (action.type) {
    case "CLICK":
      return executeClick(action);
    case "TYPE":
      return executeType(action);
    case "KEY":
      return executeKey(action);
    case "SCROLL":
      return executeScroll(action);
    case "MOVE":
      return executeMove(action);
    case "DRAG":
      return executeDrag(action);
    case "SCREENSHOT":
      return executeScreenshot(action);
    case "WAIT":
      return executeWait(action);
    case "WINDOW":
      return executeWindow(action);
    case "LAUNCH":
      return executeLaunch(action);
    case "CLIPBOARD":
      return executeClipboard(action);
    case "ASSERT":
      return executeAssert(action);
    default:
      throw new Error(`Unknown action type: ${(action as Action).type}`);
  }
}

export async function executeActionRequest(
  request: ActionRequest
): Promise<ActionResponse> {
  const startTime = Date.now();
  let preStateRef: string | undefined;
  let postStateRef: string | undefined;

  try {
    if (request.capturePreState) {
      const preShot = await executeScreenshot({
        type: "SCREENSHOT",
        format: "png",
        quality: 90,
      });
      preStateRef = preShot.screenshotPath;
    }

    const actionResult = await Promise.race([
      executeAction(request.action),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Action timeout")), request.timeoutMs)
      ),
    ]);

    if (request.capturePostState) {
      const postShot = await executeScreenshot({
        type: "SCREENSHOT",
        format: "png",
        quality: 90,
      });
      postStateRef = postShot.screenshotPath;
    }

    const durationMs = Date.now() - startTime;

    const db = await getDb();
    if (db) {
      await db.insert(actionDSLLog).values({
        actionId: request.actionId,
        taskId: request.taskId,
        userId: request.userId,
        sessionId: request.sessionId,
        actionType: request.action.type,
        argsJson: request.action as Record<string, unknown>,
        idempotencyKey: request.idempotencyKey,
        status: "completed",
        result: actionResult as Record<string, unknown>,
        durationMs,
        screenshotPreRef: preStateRef,
        screenshotPostRef: postStateRef,
      });
    }

    return {
      actionId: request.actionId,
      success: true,
      durationMs,
      preStateRef,
      postStateRef,
      result: actionResult,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const db = await getDb();
    if (db) {
      await db.insert(actionDSLLog).values({
        actionId: request.actionId,
        taskId: request.taskId,
        userId: request.userId,
        sessionId: request.sessionId,
        actionType: request.action.type,
        argsJson: request.action as Record<string, unknown>,
        idempotencyKey: request.idempotencyKey,
        status: "failed",
        errorMessage,
        durationMs,
        screenshotPreRef: preStateRef,
      });
    }

    return {
      actionId: request.actionId,
      success: false,
      error: errorMessage,
      durationMs,
      preStateRef,
    };
  }
}

export async function executeActionBatch(
  batch: ActionBatch
): Promise<ActionBatchResponse> {
  const startTime = Date.now();
  const results: ActionResponse[] = [];
  let actionsFailed = 0;

  for (const actionReq of batch.actions) {
    const result = await executeActionRequest(actionReq);
    results.push(result);

    if (!result.success) {
      actionsFailed++;
      if (batch.stopOnError) {
        break;
      }
    }

    if (batch.delayBetweenMs > 0) {
      await new Promise(r => setTimeout(r, batch.delayBetweenMs));
    }
  }

  return {
    batchId: batch.batchId,
    success: actionsFailed === 0,
    results,
    totalDurationMs: Date.now() - startTime,
    actionsCompleted: results.length,
    actionsFailed,
  };
}
