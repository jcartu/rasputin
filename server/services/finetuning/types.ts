/**
 * LoRA Fine-tuning Pipeline Types
 *
 * Defines interfaces for collecting training data from JARVIS executions
 * and orchestrating fine-tuning jobs on local GPU infrastructure.
 */

export type DataType =
  | "conversation"
  | "tool_usage"
  | "reasoning"
  | "code_generation"
  | "error_recovery";

export type TrainingJobStatus =
  | "pending"
  | "preparing"
  | "training"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

export type BaseModelType =
  | "llama-4-8b"
  | "llama-4-70b"
  | "qwen-2.5-72b"
  | "mistral-nemo"
  | "deepseek-coder";

/**
 * Single training example (input/output pair)
 */
export interface TrainingExample {
  id?: number;
  taskId: number;
  dataType: DataType;
  input: string;
  output: string;
  qualityScore: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * Filters for selecting training data
 */
export interface TrainingDataFilter {
  minQualityScore?: number;
  dataTypes?: DataType[];
  taskIds?: number[];
  afterDate?: Date;
  beforeDate?: Date;
  excludeUsedForTraining?: boolean;
  limit?: number;
}

/**
 * LoRA hyperparameters
 */
export interface LoRAConfig {
  rank: number; // Typical: 8, 16, 32, 64
  alpha: number; // Scaling factor, often rank * 2
  dropout: number; // 0.0 to 0.1
  targetModules: string[]; // e.g., ["q_proj", "v_proj", "k_proj", "o_proj"]
}

/**
 * Training hyperparameters
 */
export interface TrainingConfig {
  baseModel: BaseModelType;
  loraConfig: LoRAConfig;
  learningRate: number; // 1e-4 to 5e-4 typical
  batchSize: number; // Per-device batch size
  gradientAccumulationSteps: number;
  epochs: number;
  warmupSteps: number;
  maxSeqLength: number;
  evalSteps: number;
  saveSteps: number;
  loggingSteps: number;
  fp16: boolean;
  bf16: boolean;
  useGradientCheckpointing: boolean;
}

/**
 * Training job definition
 */
export interface TrainingJob {
  id: string;
  name: string;
  description?: string;
  status: TrainingJobStatus;
  config: TrainingConfig;
  dataFilter: TrainingDataFilter;

  // Stats
  totalExamples: number;
  trainExamples: number;
  evalExamples: number;

  // Progress
  currentEpoch: number;
  currentStep: number;
  totalSteps: number;
  trainLoss?: number;
  evalLoss?: number;

  // Timing
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;

  // Output
  outputDir: string;
  checkpointPath?: string;
  finalAdapterPath?: string;

  // Error handling
  errorMessage?: string;
  errorCount: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: number; // userId
}

/**
 * Training metrics logged during training
 */
export interface TrainingMetrics {
  jobId: string;
  step: number;
  epoch: number;
  trainLoss: number;
  evalLoss?: number;
  learningRate: number;
  gradNorm?: number;
  samplesPerSecond?: number;
  tokensPerSecond?: number;
  gpuMemoryUsed?: number;
  timestamp: Date;
}

/**
 * Evaluation result after training
 */
export interface EvaluationResult {
  jobId: string;
  evalLoss: number;
  perplexity: number;
  accuracy?: number;
  f1Score?: number;
  bleuScore?: number;
  customMetrics?: Record<string, number>;
  evaluatedAt: Date;
}

/**
 * Adapter deployment configuration
 */
export interface AdapterDeployment {
  id: string;
  jobId: string;
  adapterPath: string;
  baseModel: BaseModelType;
  deployedTo: "vllm" | "ollama";
  mergedModelName?: string;
  isActive: boolean;
  deployedAt: Date;
  undeployedAt?: Date;
}

/**
 * Request to start a new training job
 */
export interface StartTrainingRequest {
  name: string;
  description?: string;
  baseModel: BaseModelType;
  dataFilter: TrainingDataFilter;
  config?: Partial<TrainingConfig>;
  userId: number;
}

/**
 * Training progress update (for WebSocket streaming)
 */
export interface TrainingProgressUpdate {
  jobId: string;
  type: "progress" | "log" | "metrics" | "status" | "error";
  data:
    | {
        epoch: number;
        step: number;
        totalSteps: number;
        loss: number;
        eta?: string;
      }
    | {
        level: "info" | "warn" | "error";
        message: string;
      }
    | TrainingMetrics
    | { status: TrainingJobStatus }
    | { error: string };
  timestamp: Date;
}

/**
 * Conversation format for training (ChatML-style)
 */
export interface ChatMLConversation {
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string; // For tool calls
    toolCallId?: string;
    toolCalls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }>;
}

/**
 * Dataset statistics
 */
export interface DatasetStats {
  totalExamples: number;
  byDataType: Record<DataType, number>;
  averageQualityScore: number;
  averageInputLength: number;
  averageOutputLength: number;
  totalTokensEstimate: number;
  oldestExample: Date;
  newestExample: Date;
}

/**
 * Default LoRA config for different model sizes
 */
export const DEFAULT_LORA_CONFIGS: Record<string, LoRAConfig> = {
  "8b": {
    rank: 16,
    alpha: 32,
    dropout: 0.05,
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj"],
  },
  "70b": {
    rank: 8,
    alpha: 16,
    dropout: 0.05,
    targetModules: ["q_proj", "v_proj"],
  },
  "72b": {
    rank: 8,
    alpha: 16,
    dropout: 0.05,
    targetModules: ["q_proj", "v_proj"],
  },
};

/**
 * Default training config
 */
export const DEFAULT_TRAINING_CONFIG: Omit<TrainingConfig, "baseModel"> = {
  loraConfig: DEFAULT_LORA_CONFIGS["8b"],
  learningRate: 2e-4,
  batchSize: 4,
  gradientAccumulationSteps: 4,
  epochs: 3,
  warmupSteps: 100,
  maxSeqLength: 4096,
  evalSteps: 100,
  saveSteps: 500,
  loggingSteps: 10,
  fp16: false,
  bf16: true, // Prefer bf16 on modern GPUs
  useGradientCheckpointing: true,
};
