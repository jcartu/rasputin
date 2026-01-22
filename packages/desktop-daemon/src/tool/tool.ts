import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Tool {
  export interface Context {
    abort: AbortSignal;
    sessionId: string;
    callId: string;
    metadata(input: { title?: string; data?: Record<string, unknown> }): void;
  }

  export interface Attachment {
    type: "image" | "file";
    name: string;
    data: string;
    mimeType: string;
  }

  export interface Result {
    output: string;
    metadata?: Record<string, unknown>;
    attachments?: Attachment[];
  }

  export interface Info<P extends z.ZodType = z.ZodType> {
    id: string;
    description: string;
    parameters: P;
    execute(args: z.infer<P>, ctx: Context): Promise<Result>;
  }

  export function define<P extends z.ZodType>(
    id: string,
    config: Omit<Info<P>, "id">
  ): Info<P> {
    return { id, ...config };
  }
}
