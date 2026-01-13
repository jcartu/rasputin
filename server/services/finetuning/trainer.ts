import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { EventEmitter } from "events";
import {
  getTrainingData,
  markDataAsUsed,
  exportToJsonl,
} from "./dataCollector";
import type {
  TrainingJob,
  TrainingConfig,
  TrainingDataFilter,
  TrainingMetrics,
  TrainingProgressUpdate,
  StartTrainingRequest,
  TrainingJobStatus,
  BaseModelType,
  DEFAULT_TRAINING_CONFIG,
  DEFAULT_LORA_CONFIGS,
} from "./types";
import {
  DEFAULT_TRAINING_CONFIG as defaultConfig,
  DEFAULT_LORA_CONFIGS as loraConfigs,
} from "./types";

const execAsync = promisify(exec);

const TRAINING_DIR = process.env.TRAINING_DIR || "/tmp/jarvis-training";
const ADAPTERS_DIR = process.env.ADAPTERS_DIR || "/tmp/jarvis-adapters";

const MODEL_PATHS: Record<BaseModelType, string> = {
  "llama-4-8b": "meta-llama/Llama-4-Scout-8B-Instruct",
  "llama-4-70b": "meta-llama/Llama-4-Maverick-70B-Instruct",
  "qwen-2.5-72b": "Qwen/Qwen2.5-72B-Instruct",
  "mistral-nemo": "mistralai/Mistral-Nemo-Instruct-2407",
  "deepseek-coder": "deepseek-ai/deepseek-coder-33b-instruct",
};

interface TrainerEvents {
  progress: (update: TrainingProgressUpdate) => void;
  completed: (job: TrainingJob) => void;
  failed: (job: TrainingJob, error: Error) => void;
}

class TrainingJobManager extends EventEmitter {
  private jobs: Map<string, TrainingJob> = new Map();
  private activeProcess: ReturnType<typeof spawn> | null = null;

  async startJob(request: StartTrainingRequest): Promise<TrainingJob> {
    const jobId = `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const modelSize =
      request.baseModel.includes("70b") || request.baseModel.includes("72b")
        ? "70b"
        : "8b";

    const loraConfig = loraConfigs[modelSize] || loraConfigs["8b"];

    const config: TrainingConfig = {
      ...defaultConfig,
      baseModel: request.baseModel,
      loraConfig,
      ...request.config,
    };

    const data = await getTrainingData(request.dataFilter);
    if (data.length < 10) {
      throw new Error(
        `Insufficient training data: ${data.length} examples (minimum 10)`
      );
    }

    const splitIdx = Math.floor(data.length * 0.9);
    const trainCount = splitIdx;
    const evalCount = data.length - splitIdx;

    const outputDir = path.join(TRAINING_DIR, jobId);
    await fs.mkdir(outputDir, { recursive: true });

    const job: TrainingJob = {
      id: jobId,
      name: request.name,
      description: request.description,
      status: "pending",
      config,
      dataFilter: request.dataFilter,
      totalExamples: data.length,
      trainExamples: trainCount,
      evalExamples: evalCount,
      currentEpoch: 0,
      currentStep: 0,
      totalSteps: Math.ceil(trainCount / config.batchSize) * config.epochs,
      outputDir,
      errorCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: request.userId,
    };

    this.jobs.set(jobId, job);

    this.runTrainingJob(job, request.dataFilter).catch(error => {
      console.error(`[Trainer] Job ${jobId} failed:`, error);
    });

    return job;
  }

  private async runTrainingJob(
    job: TrainingJob,
    filter: TrainingDataFilter
  ): Promise<void> {
    try {
      this.updateJobStatus(job.id, "preparing");

      const trainPath = path.join(job.outputDir, "train.jsonl");
      const evalPath = path.join(job.outputDir, "eval.jsonl");

      const allData = await getTrainingData(filter);
      const splitIdx = Math.floor(allData.length * 0.9);

      const trainFilter = { ...filter, limit: splitIdx };
      const evalFilter = { ...filter, limit: allData.length - splitIdx };

      await exportToJsonl(trainFilter, trainPath);

      const evalData = allData.slice(splitIdx);
      const evalLines = evalData.map(d =>
        JSON.stringify({
          messages: [
            { role: "user", content: d.input },
            { role: "assistant", content: d.output },
          ],
        })
      );
      await fs.writeFile(evalPath, evalLines.join("\n"), "utf-8");

      const configPath = path.join(job.outputDir, "config.yaml");
      await this.writeTrainingConfig(job, configPath, trainPath, evalPath);

      this.updateJobStatus(job.id, "training");

      await this.executeTraining(job, configPath);

      this.updateJobStatus(job.id, "validating");

      const adapterPath = path.join(job.outputDir, "adapter");
      if (await this.fileExists(adapterPath)) {
        job.finalAdapterPath = adapterPath;

        const ids = allData
          .map(d => d.id)
          .filter((id): id is number => id !== undefined);
        if (ids.length > 0) {
          await markDataAsUsed(ids, job.id);
        }
      }

      this.updateJobStatus(job.id, "completed");
      job.completedAt = new Date();

      this.emit("completed", job);
    } catch (error) {
      job.errorCount++;
      job.errorMessage = error instanceof Error ? error.message : String(error);
      this.updateJobStatus(job.id, "failed");
      this.emit(
        "failed",
        job,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async writeTrainingConfig(
    job: TrainingJob,
    configPath: string,
    trainPath: string,
    evalPath: string
  ): Promise<void> {
    const modelPath = MODEL_PATHS[job.config.baseModel];
    const lora = job.config.loraConfig;

    const config = `
base_model: ${modelPath}
model_type: LlamaForCausalLM
tokenizer_type: AutoTokenizer

load_in_8bit: false
load_in_4bit: true

adapter: lora
lora_r: ${lora.rank}
lora_alpha: ${lora.alpha}
lora_dropout: ${lora.dropout}
lora_target_modules:
${lora.targetModules.map(m => `  - ${m}`).join("\n")}

datasets:
  - path: ${trainPath}
    type: sharegpt

val_set_size: 0.1
output_dir: ${job.outputDir}/adapter

sequence_len: ${job.config.maxSeqLength}
sample_packing: true
pad_to_sequence_len: true

gradient_accumulation_steps: ${job.config.gradientAccumulationSteps}
micro_batch_size: ${job.config.batchSize}
num_epochs: ${job.config.epochs}
learning_rate: ${job.config.learningRate}

optimizer: adamw_8bit
lr_scheduler: cosine
warmup_steps: ${job.config.warmupSteps}

bf16: ${job.config.bf16}
fp16: ${job.config.fp16}
gradient_checkpointing: ${job.config.useGradientCheckpointing}

logging_steps: ${job.config.loggingSteps}
save_steps: ${job.config.saveSteps}
eval_steps: ${job.config.evalSteps}

deepspeed:
flash_attention: true
`.trim();

    await fs.writeFile(configPath, config, "utf-8");
  }

  private async executeTraining(
    job: TrainingJob,
    configPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn("python", ["-m", "axolotl.cli.train", configPath], {
        cwd: job.outputDir,
        env: {
          ...globalThis.process.env,
          CUDA_VISIBLE_DEVICES: "0,1",
          WANDB_DISABLED: "true",
        },
      });

      this.activeProcess = process;

      let stderr = "";

      process.stdout.on("data", (data: Buffer) => {
        const line = data.toString();
        this.parseTrainingOutput(job, line);
      });

      process.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
        const line = data.toString();

        if (line.includes("loss")) {
          this.parseTrainingOutput(job, line);
        }
      });

      process.on("close", code => {
        this.activeProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Training failed with code ${code}: ${stderr.slice(-500)}`
            )
          );
        }
      });

      process.on("error", error => {
        this.activeProcess = null;
        reject(error);
      });
    });
  }

  private parseTrainingOutput(job: TrainingJob, line: string): void {
    const stepMatch = line.match(/step\s+(\d+)/i);
    const lossMatch = line.match(/loss[:\s]+([0-9.]+)/i);
    const epochMatch = line.match(/epoch\s+([0-9.]+)/i);

    if (stepMatch || lossMatch || epochMatch) {
      const update: TrainingProgressUpdate = {
        jobId: job.id,
        type: "progress",
        data: {
          epoch: epochMatch ? parseFloat(epochMatch[1]) : job.currentEpoch,
          step: stepMatch ? parseInt(stepMatch[1]) : job.currentStep,
          totalSteps: job.totalSteps,
          loss: lossMatch ? parseFloat(lossMatch[1]) : job.trainLoss || 0,
        },
        timestamp: new Date(),
      };

      if (stepMatch) job.currentStep = parseInt(stepMatch[1]);
      if (epochMatch) job.currentEpoch = parseFloat(epochMatch[1]);
      if (lossMatch) job.trainLoss = parseFloat(lossMatch[1]);

      this.emit("progress", update);
    }
  }

  private updateJobStatus(jobId: string, status: TrainingJobStatus): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date();

      const update: TrainingProgressUpdate = {
        jobId,
        type: "status",
        data: { status },
        timestamp: new Date(),
      };
      this.emit("progress", update);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getJob(jobId: string): TrainingJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): TrainingJob[] {
    return Array.from(this.jobs.values());
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === "training" && this.activeProcess) {
      this.activeProcess.kill("SIGTERM");
      this.activeProcess = null;
    }

    job.status = "cancelled";
    job.updatedAt = new Date();
    return true;
  }
}

let trainerInstance: TrainingJobManager | null = null;

export function getTrainer(): TrainingJobManager {
  if (!trainerInstance) {
    trainerInstance = new TrainingJobManager();
  }
  return trainerInstance;
}

export async function deployAdapter(
  jobId: string,
  target: "vllm" | "ollama"
): Promise<string> {
  const trainer = getTrainer();
  const job = trainer.getJob(jobId);

  if (!job || !job.finalAdapterPath) {
    throw new Error(`Job ${jobId} not found or has no adapter`);
  }

  const adapterName = `jarvis-${job.config.baseModel}-${job.id.slice(-6)}`;

  if (target === "ollama") {
    const modelfile = `
FROM ${MODEL_PATHS[job.config.baseModel]}
ADAPTER ${job.finalAdapterPath}
`.trim();

    const modelfilePath = path.join(job.outputDir, "Modelfile");
    await fs.writeFile(modelfilePath, modelfile, "utf-8");

    await execAsync(`ollama create ${adapterName} -f ${modelfilePath}`);
  } else {
    const targetDir = path.join(ADAPTERS_DIR, adapterName);
    await fs.mkdir(targetDir, { recursive: true });
    await execAsync(`cp -r ${job.finalAdapterPath}/* ${targetDir}/`);

    console.info(`[Trainer] vLLM adapter deployed to ${targetDir}`);
    console.info(
      `[Trainer] Add to vLLM with: --lora-modules ${adapterName}=${targetDir}`
    );
  }

  return adapterName;
}

export { TrainingJobManager };
