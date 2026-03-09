# Section 9: Hardware Democratization — Consumer GPUs Running 122B Models

## 9.1 From Multi-GPU to Single-GPU: The NVFP4 Breakthrough

The memory architecture described in Sections 3–6 was designed under the assumption of consumer-grade hardware — but until recently, "consumer-grade" still meant multi-GPU configurations for frontier-scale models. Running Qwen 2.5 72B in Q8_0 quantization required approximately 150GB of VRAM across two RTX PRO 6000 GPUs (96GB each), consuming the system's full GPU budget and leaving no dedicated resources for memory infrastructure services (embedding generation, neural reranking, graph queries).

NVIDIA's Blackwell architecture introduced native FP4 (NVFP4) tensor core support, enabling 4-bit floating-point inference at the hardware level rather than through software emulation. The theoretical promise is straightforward: a model that requires 150GB in 8-bit quantization should require approximately 75–90GB in 4-bit, potentially fitting on a single GPU.

We validated this promise empirically. Qwen 3.5 122B-A10B — a Mixture-of-Experts model with 122 billion total parameters and approximately 10 billion active per token — runs in native NVFP4 on a single RTX PRO 6000 at 31 tokens per second, consuming 89.2GB of the GPU's 95.6GB available VRAM. The model checkpoint (Sehyo/Qwen3.5-122B-A10B-NVFP4, compressed-tensors format) occupies 76GB on disk. With piecewise CUDA graph compilation, throughput reaches 31 tok/s — a 2.6× improvement over eager mode (12 tok/s) and competitive with the previous Q8_0 llama.cpp configuration that required two GPUs.

| Configuration | Model | Quantization | GPUs | VRAM | Throughput |
|--------------|-------|-------------|------|------|------------|
| Previous | Qwen 2.5 72B | Q8_0 (GGUF) | 2× RTX PRO 6000 | ~150GB | ~20–25 tok/s |
| Current | Qwen 3.5 122B-A10B | NVFP4 (compressed-tensors) | 1× RTX PRO 6000 | 89GB | 31 tok/s |

*Table 11: Infrastructure comparison before and after NVFP4 migration.*

The transition is significant on three axes simultaneously: the model is larger (122B vs 72B), the throughput is higher (31 vs ~22 tok/s), and the GPU count is halved (1 vs 2).

## 9.2 Freeing Resources for Agent Infrastructure

The consolidation from two GPUs to one has direct implications for the memory system described in this paper. With the primary inference model occupying a single GPU, the freed GPU becomes available for dedicated agent infrastructure:

- **Embedding generation** (Nomic Embed Text via Ollama) — previously time-sharing with the inference model
- **Neural reranking** (BAAI/bge-reranker-v2-m3) — previously competing for VRAM with model weights
- **Auxiliary inference** — fact extraction, memory consolidation, and other maintenance pipelines from Layer 5 (Section 3.6) can run on dedicated hardware without degrading primary inference throughput
- **Knowledge graph operations** — FalkorDB's in-memory graph (240K+ nodes, 535K+ edges) benefits from dedicated memory bandwidth

This architectural shift transforms the system from a resource-contended shared environment to a purpose-built agent infrastructure where inference, memory, and maintenance are physically isolated on separate GPUs. The memory system's p50 retrieval latency of 216ms (Table 6) is no longer subject to interference from model loading or inference batching on the same GPU.

## 9.3 Overcoming Artificial Software Restrictions

The path to NVFP4 on consumer Blackwell was not straightforward. NVIDIA's own TensorRT-LLM explicitly blocks desktop Blackwell GPUs (SM120) from FP4 inference with the error: `"FP4 Gemm not supported before Blackwell, nor GeForce Blackwell"`. This is a product segmentation decision, not a hardware limitation — SM120 (RTX 5090, RTX PRO 6000) shares the same FP4 tensor core architecture as SM100 (B100, B200 datacenter chips).

The open-source inference stack (vLLM, SGLang) provides an alternative path, but also contained SM120 dispatch bugs. vLLM's quantization backend selection logic (`mxfp4.py`) checked `is_device_capability_family(100)` to determine NVFP4 support — a check that returns `False` for SM120 (capability family 120), causing fallback to Marlin weight-only quantization despite CUTLASS SM120 FP4 kernels being compiled into the binary.

The fix required adding SM120 to capability checks in approximately 6 files across vLLM's quantization and MoE dispatch paths (documented in vLLM Issues #33416 and #31085). This contribution — identifying the dispatch gap, validating the fix on production hardware, and documenting the affected code paths — represents a practical example of the paper's broader thesis: consumer hardware is capable of running frontier-scale AI systems, but realizing this capability requires active engagement with the open-source stack.

## 9.4 Implications for the Cartu Method

The NVFP4 result validates a key assumption of this paper: that complete AI agent systems — including frontier-scale language models, persistent memory infrastructure, and autonomous maintenance pipelines — can run on consumer hardware at effectively zero marginal cost.

The updated hardware configuration runs:
- **Qwen 3.5 122B** (NVFP4, single GPU) — primary reasoning and inference
- **Nomic Embed Text + bge-reranker-v2-m3** (second GPU) — embedding and reranking for the memory system
- **Qdrant + FalkorDB** (CPU/RAM) — vector and graph storage
- **Maintenance pipelines** (second GPU, scheduled) — fact extraction, consolidation, graph deepening

Total cloud API cost: $10–20/month (compaction rescue only). Total hardware cost: ~$15,000 (one-time). Effective per-day operating cost: $0 for inference and memory operations.

The combination of NVFP4 quantization and Mixture-of-Experts architecture represents a step function in what is achievable on consumer hardware. A 122-billion-parameter model running at 31 tokens per second on a single desktop GPU — while simultaneously maintaining a 96K-vector memory system with knowledge graph, neural reranking, and autonomous maintenance — would have been implausible twelve months ago. The hardware democratization that this paper's architecture depends on is not theoretical. It is measured and deployed.
