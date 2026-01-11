/**
 * Error Classification System for JARVIS
 * Classifies errors to enable intelligent retry, fallback, and learning decisions
 */

import * as crypto from "crypto";

export type ErrorClass =
  | "timeout"
  | "not_found"
  | "code_error"
  | "rate_limit"
  | "auth_error"
  | "network_error"
  | "validation_error"
  | "unknown";

export interface ClassifiedError {
  class: ErrorClass;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  httpStatus?: number;
  provider?: string;
  signature: string;
  toolName?: string;
  raw?: unknown;
}

export interface ClassificationInput {
  toolName: string;
  output?: string;
  error?: unknown;
  httpStatus?: number;
  provider?: string;
}

const TIMEOUT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /ETIMEDOUT/i,
  /AbortError/i,
  /AbortSignal/i,
  /ESOCKETTIMEDOUT/i,
  /deadline exceeded/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /throttl/i,
  /429/,
  /capacity/i,
  /overloaded/i,
];

const AUTH_PATTERNS = [
  /unauthorized/i,
  /invalid.*api.*key/i,
  /authentication/i,
  /forbidden/i,
  /access denied/i,
  /401/,
  /403/,
  /invalid.*token/i,
  /expired.*token/i,
];

const NOT_FOUND_PATTERNS = [
  /not found/i,
  /404/,
  /ENOENT/i,
  /no such file/i,
  /does not exist/i,
  /missing/i,
  /unknown.*command/i,
  /command not found/i,
];

const VALIDATION_PATTERNS = [
  /invalid input/i,
  /validation/i,
  /schema/i,
  /required.*field/i,
  /type.*error/i,
  /expected.*but.*got/i,
  /must be/i,
  /cannot be/i,
  /malformed/i,
];

const NETWORK_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /network/i,
  /fetch failed/i,
  /socket hang up/i,
  /EPIPE/i,
  /DNS/i,
  /connection.*refused/i,
  /unable to connect/i,
];

const CODE_ERROR_PATTERNS = [
  /SyntaxError/i,
  /TypeError/i,
  /ReferenceError/i,
  /RangeError/i,
  /undefined is not/i,
  /cannot read propert/i,
  /is not a function/i,
  /unexpected token/i,
  /IndentationError/i,
  /NameError/i,
  /AttributeError/i,
  /ImportError/i,
  /ModuleNotFoundError/i,
  /Traceback/i,
  /exit code/i,
];

function matchesPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

function generateSignature(
  input: ClassificationInput,
  errorClass: ErrorClass
): string {
  const parts = [input.toolName, errorClass, input.provider || "unknown"];

  const normalized = parts.join(":").toLowerCase();
  return crypto.createHash("md5").update(normalized).digest("hex").slice(0, 12);
}

export function classifyError(input: ClassificationInput): ClassifiedError {
  const errorText = buildErrorText(input);
  const httpStatus = input.httpStatus || extractHttpStatus(errorText);

  let errorClass: ErrorClass = "unknown";
  let retryable = false;
  let retryAfterMs: number | undefined;

  if (httpStatus === 429 || matchesPatterns(errorText, RATE_LIMIT_PATTERNS)) {
    errorClass = "rate_limit";
    retryable = true;
    retryAfterMs = extractRetryAfter(errorText) || 5000;
  } else if (
    httpStatus === 408 ||
    matchesPatterns(errorText, TIMEOUT_PATTERNS)
  ) {
    errorClass = "timeout";
    retryable = true;
    retryAfterMs = 2000;
  } else if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    matchesPatterns(errorText, AUTH_PATTERNS)
  ) {
    errorClass = "auth_error";
    retryable = false;
  } else if (
    httpStatus === 404 ||
    matchesPatterns(errorText, NOT_FOUND_PATTERNS)
  ) {
    errorClass = "not_found";
    retryable = false;
  } else if (matchesPatterns(errorText, VALIDATION_PATTERNS)) {
    errorClass = "validation_error";
    retryable = false;
  } else if (matchesPatterns(errorText, NETWORK_PATTERNS)) {
    errorClass = "network_error";
    retryable = true;
    retryAfterMs = 3000;
  } else if (matchesPatterns(errorText, CODE_ERROR_PATTERNS)) {
    errorClass = "code_error";
    retryable = false;
  }

  return {
    class: errorClass,
    message: truncateMessage(errorText),
    retryable,
    retryAfterMs,
    httpStatus,
    provider: input.provider,
    signature: generateSignature(input, errorClass),
    toolName: input.toolName,
    raw: input.error,
  };
}

function buildErrorText(input: ClassificationInput): string {
  const parts: string[] = [];

  if (input.output) {
    parts.push(input.output);
  }

  if (input.error) {
    if (input.error instanceof Error) {
      parts.push(input.error.message);
      if (input.error.name) parts.push(input.error.name);
    } else if (typeof input.error === "string") {
      parts.push(input.error);
    } else {
      parts.push(JSON.stringify(input.error));
    }
  }

  return parts.join(" ");
}

function extractHttpStatus(text: string): number | undefined {
  const match = text.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

function extractRetryAfter(text: string): number | undefined {
  const match = text.match(/retry.{0,10}(\d+)\s*(s|sec|second|ms|millisec)/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("ms") || unit.startsWith("milli")) {
      return value;
    }
    return value * 1000;
  }
  return undefined;
}

function truncateMessage(message: string, maxLength: number = 500): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + "...";
}

export function shouldRetry(
  classified: ClassifiedError,
  attemptNumber: number
): boolean {
  if (!classified.retryable) return false;

  const maxRetries: Record<ErrorClass, number> = {
    timeout: 2,
    rate_limit: 3,
    network_error: 2,
    code_error: 0,
    auth_error: 0,
    not_found: 0,
    validation_error: 0,
    unknown: 1,
  };

  return attemptNumber < maxRetries[classified.class];
}

export function getRetryDelay(
  classified: ClassifiedError,
  attemptNumber: number
): number {
  const baseDelay = classified.retryAfterMs || 1000;
  return baseDelay * Math.pow(2, attemptNumber);
}

export function formatErrorForLog(classified: ClassifiedError): string {
  return `[${classified.class.toUpperCase()}] ${classified.toolName || "unknown"}: ${classified.message} (sig: ${classified.signature})`;
}

export function isRetryableClass(errorClass: ErrorClass): boolean {
  return ["timeout", "rate_limit", "network_error"].includes(errorClass);
}
