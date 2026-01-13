/**
 * Action DSL - Domain Specific Language for Desktop Automation
 *
 * This module defines a structured action language that JARVIS uses to control
 * the desktop. Actions are atomic, idempotent operations that can be verified.
 *
 * Architecture:
 * - Claude/GPT thinks in natural language about WHAT to do
 * - Cerebras (fast, cheap) formats the output into valid Action DSL
 * - Desktop daemon executes the action
 * - Vision verifies the result
 */

import { z } from "zod";

// ============================================================================
// Base Types
// ============================================================================

/** Coordinates on screen (absolute pixels) */
export const PointSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});
export type Point = z.infer<typeof PointSchema>;

/** Rectangle region on screen */
export const RectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});
export type Rect = z.infer<typeof RectSchema>;

/** Mouse button */
export const MouseButton = z.enum(["left", "right", "middle"]);
export type MouseButton = z.infer<typeof MouseButton>;

/** Keyboard modifier keys */
export const ModifierKey = z.enum(["ctrl", "alt", "shift", "meta", "super"]);
export type ModifierKey = z.infer<typeof ModifierKey>;

// ============================================================================
// Action Types - Atomic Desktop Operations
// ============================================================================

/**
 * CLICK - Click at coordinates or on an element
 */
export const ClickActionSchema = z.object({
  type: z.literal("CLICK"),
  /** Target coordinates (if known) */
  point: PointSchema.optional(),
  /** Natural language description of what to click (for vision fallback) */
  target: z.string().optional(),
  /** Which button */
  button: MouseButton.default("left"),
  /** Double click */
  double: z.boolean().default(false),
  /** Modifier keys to hold */
  modifiers: z.array(ModifierKey).default([]),
});
export type ClickAction = z.infer<typeof ClickActionSchema>;

/**
 * TYPE - Type text into focused element
 */
export const TypeActionSchema = z.object({
  type: z.literal("TYPE"),
  /** Text to type */
  text: z.string(),
  /** Clear existing content first */
  clear: z.boolean().default(false),
  /** Submit after typing (press Enter) */
  submit: z.boolean().default(false),
  /** Type character by character (slower, more reliable) */
  charByChar: z.boolean().default(false),
  /** Delay between characters in ms (if charByChar) */
  charDelayMs: z.number().int().min(0).max(500).default(50),
});
export type TypeAction = z.infer<typeof TypeActionSchema>;

/**
 * KEY - Press a keyboard key or combination
 */
export const KeyActionSchema = z.object({
  type: z.literal("KEY"),
  /** Main key to press */
  key: z.string(), // e.g., "Enter", "Tab", "Escape", "a", "F1"
  /** Modifier keys to hold */
  modifiers: z.array(ModifierKey).default([]),
  /** Hold the key down (for key combos) */
  hold: z.boolean().default(false),
  /** Release a held key */
  release: z.boolean().default(false),
});
export type KeyAction = z.infer<typeof KeyActionSchema>;

/**
 * SCROLL - Scroll in a direction
 */
export const ScrollActionSchema = z.object({
  type: z.literal("SCROLL"),
  /** Direction */
  direction: z.enum(["up", "down", "left", "right"]),
  /** Amount (pixels or "page") */
  amount: z.union([z.number().int().min(1), z.literal("page")]).default(100),
  /** Target point (scroll at this position) */
  point: PointSchema.optional(),
});
export type ScrollAction = z.infer<typeof ScrollActionSchema>;

/**
 * MOVE - Move mouse to position
 */
export const MoveActionSchema = z.object({
  type: z.literal("MOVE"),
  /** Target coordinates */
  point: PointSchema,
  /** Smooth movement vs instant */
  smooth: z.boolean().default(true),
  /** Duration of smooth movement in ms */
  durationMs: z.number().int().min(0).max(2000).default(200),
});
export type MoveAction = z.infer<typeof MoveActionSchema>;

/**
 * DRAG - Drag from one point to another
 */
export const DragActionSchema = z.object({
  type: z.literal("DRAG"),
  /** Start point */
  from: PointSchema,
  /** End point */
  to: PointSchema,
  /** Which button to hold */
  button: MouseButton.default("left"),
  /** Duration of drag in ms */
  durationMs: z.number().int().min(100).max(5000).default(500),
});
export type DragAction = z.infer<typeof DragActionSchema>;

/**
 * SCREENSHOT - Capture screen or region
 */
export const ScreenshotActionSchema = z.object({
  type: z.literal("SCREENSHOT"),
  /** Region to capture (full screen if omitted) */
  region: RectSchema.optional(),
  /** Output format */
  format: z.enum(["png", "jpeg", "webp"]).default("png"),
  /** Quality (for jpeg/webp) */
  quality: z.number().int().min(1).max(100).default(90),
});
export type ScreenshotAction = z.infer<typeof ScreenshotActionSchema>;

/**
 * WAIT - Wait for a condition or duration
 */
export const WaitActionSchema = z.object({
  type: z.literal("WAIT"),
  /** Wait type */
  waitFor: z.enum(["duration", "idle", "element"]),
  /** Duration in ms (for duration wait) */
  durationMs: z.number().int().min(0).max(30000).optional(),
  /** Element description (for element wait) */
  element: z.string().optional(),
  /** Timeout for element/idle wait */
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export type WaitAction = z.infer<typeof WaitActionSchema>;

/**
 * WINDOW - Window management operations
 */
export const WindowActionSchema = z.object({
  type: z.literal("WINDOW"),
  /** Operation */
  operation: z.enum([
    "focus",
    "minimize",
    "maximize",
    "restore",
    "close",
    "move",
    "resize",
  ]),
  /** Window identifier (title, class, or PID) */
  window: z.string().optional(),
  /** New position (for move) */
  position: PointSchema.optional(),
  /** New size (for resize) */
  size: z
    .object({ width: z.number().int().min(1), height: z.number().int().min(1) })
    .optional(),
});
export type WindowAction = z.infer<typeof WindowActionSchema>;

/**
 * LAUNCH - Launch an application
 */
export const LaunchActionSchema = z.object({
  type: z.literal("LAUNCH"),
  /** Application to launch (name, path, or command) */
  app: z.string(),
  /** Arguments */
  args: z.array(z.string()).default([]),
  /** Working directory */
  cwd: z.string().optional(),
  /** Wait for window to appear */
  waitForWindow: z.boolean().default(true),
  /** Timeout for window to appear */
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export type LaunchAction = z.infer<typeof LaunchActionSchema>;

/**
 * CLIPBOARD - Clipboard operations
 */
export const ClipboardActionSchema = z.object({
  type: z.literal("CLIPBOARD"),
  /** Operation */
  operation: z.enum(["copy", "paste", "set", "get"]),
  /** Text to set (for set operation) */
  text: z.string().optional(),
});
export type ClipboardAction = z.infer<typeof ClipboardActionSchema>;

/**
 * ASSERT - Verify screen state (for verification step)
 */
export const AssertActionSchema = z.object({
  type: z.literal("ASSERT"),
  /** What to assert */
  assertType: z.enum([
    "element_visible",
    "element_not_visible",
    "text_present",
    "text_not_present",
    "color_at_point",
  ]),
  /** Element or text to check */
  target: z.string(),
  /** Point to check (for color_at_point) */
  point: PointSchema.optional(),
  /** Expected color (for color_at_point) */
  color: z.string().optional(),
  /** Timeout for condition */
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
});
export type AssertAction = z.infer<typeof AssertActionSchema>;

// ============================================================================
// Union Action Type
// ============================================================================

export const ActionSchema = z.discriminatedUnion("type", [
  ClickActionSchema,
  TypeActionSchema,
  KeyActionSchema,
  ScrollActionSchema,
  MoveActionSchema,
  DragActionSchema,
  ScreenshotActionSchema,
  WaitActionSchema,
  WindowActionSchema,
  LaunchActionSchema,
  ClipboardActionSchema,
  AssertActionSchema,
]);
export type Action = z.infer<typeof ActionSchema>;

// ============================================================================
// Action Request/Response
// ============================================================================

export const ActionRequestSchema = z.object({
  /** Unique action ID (for idempotency) */
  actionId: z.string(),
  /** Parent task ID */
  taskId: z.number().int(),
  /** User ID */
  userId: z.number().int(),
  /** Session ID */
  sessionId: z.string(),
  /** The action to execute */
  action: ActionSchema,
  /** Idempotency key (prevents duplicate execution) */
  idempotencyKey: z.string().optional(),
  /** Pre-action screenshot requested */
  capturePreState: z.boolean().default(false),
  /** Post-action screenshot requested */
  capturePostState: z.boolean().default(true),
  /** Timeout for this action */
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const ActionResponseSchema = z.object({
  /** Action ID */
  actionId: z.string(),
  /** Success */
  success: z.boolean(),
  /** Error message (if failed) */
  error: z.string().optional(),
  /** Duration in ms */
  durationMs: z.number().int(),
  /** Pre-state screenshot reference (blob ID) */
  preStateRef: z.string().optional(),
  /** Post-state screenshot reference (blob ID) */
  postStateRef: z.string().optional(),
  /** Result data (depends on action type) */
  result: z.unknown().optional(),
});
export type ActionResponse = z.infer<typeof ActionResponseSchema>;

// ============================================================================
// Batch Actions
// ============================================================================

export const ActionBatchSchema = z.object({
  /** Batch ID */
  batchId: z.string(),
  /** Task ID */
  taskId: z.number().int(),
  /** User ID */
  userId: z.number().int(),
  /** Session ID */
  sessionId: z.string(),
  /** Actions to execute in sequence */
  actions: z.array(ActionRequestSchema),
  /** Stop on first error */
  stopOnError: z.boolean().default(true),
  /** Delay between actions in ms */
  delayBetweenMs: z.number().int().min(0).max(5000).default(100),
});
export type ActionBatch = z.infer<typeof ActionBatchSchema>;

export const ActionBatchResponseSchema = z.object({
  /** Batch ID */
  batchId: z.string(),
  /** Overall success */
  success: z.boolean(),
  /** Individual results */
  results: z.array(ActionResponseSchema),
  /** Total duration in ms */
  totalDurationMs: z.number().int(),
  /** Number of actions completed */
  actionsCompleted: z.number().int(),
  /** Number of actions failed */
  actionsFailed: z.number().int(),
});
export type ActionBatchResponse = z.infer<typeof ActionBatchResponseSchema>;

// ============================================================================
// Action DSL Parser (for Cerebras output)
// ============================================================================

/**
 * Parse action from JSON string (from LLM output)
 */
export function parseAction(jsonStr: string): Action {
  try {
    const parsed = JSON.parse(jsonStr);
    return ActionSchema.parse(parsed);
  } catch (error) {
    throw new Error(
      `Failed to parse action: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse multiple actions from JSON array string
 */
export function parseActions(jsonStr: string): Action[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected array of actions");
    }
    return parsed.map((a, i) => {
      try {
        return ActionSchema.parse(a);
      } catch (e) {
        throw new Error(
          `Action ${i}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    });
  } catch (error) {
    throw new Error(
      `Failed to parse actions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate an action request
 */
export function validateActionRequest(data: unknown): ActionRequest {
  return ActionRequestSchema.parse(data);
}

/**
 * Validate a batch request
 */
export function validateBatchRequest(data: unknown): ActionBatch {
  return ActionBatchSchema.parse(data);
}

// ============================================================================
// Action DSL Examples (for prompt engineering)
// ============================================================================

export const ACTION_EXAMPLES = {
  click_button: {
    type: "CLICK",
    point: { x: 500, y: 300 },
    button: "left",
  },
  click_by_description: {
    type: "CLICK",
    target: "the blue Submit button in the bottom right",
    button: "left",
  },
  type_text: {
    type: "TYPE",
    text: "Hello, world!",
    clear: true,
    submit: false,
  },
  keyboard_shortcut: {
    type: "KEY",
    key: "s",
    modifiers: ["ctrl"],
  },
  scroll_down: {
    type: "SCROLL",
    direction: "down",
    amount: 300,
  },
  take_screenshot: {
    type: "SCREENSHOT",
    format: "png",
  },
  wait_for_element: {
    type: "WAIT",
    waitFor: "element",
    element: "loading spinner disappears",
    timeoutMs: 10000,
  },
  launch_app: {
    type: "LAUNCH",
    app: "firefox",
    args: ["https://example.com"],
    waitForWindow: true,
  },
  copy_text: {
    type: "CLIPBOARD",
    operation: "copy",
  },
  verify_element: {
    type: "ASSERT",
    assertType: "element_visible",
    target: "success message",
    timeoutMs: 5000,
  },
};

/**
 * Get example actions as formatted JSON for prompts
 */
export function getActionExamplesForPrompt(): string {
  return JSON.stringify(ACTION_EXAMPLES, null, 2);
}
