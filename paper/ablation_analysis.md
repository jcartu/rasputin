# RASPUTIN Memory System: Ablation Study & Baseline Comparison

*Generated: 2026-03-07T15:54:10.312450*

*System: 96,649 vectors, 240,957 graph nodes, 768d nomic-embed-text*

*30 queries × 6 categories × 5 configurations × 3 trials each*


## 1. Configuration Performance Summary

| Configuration | Precision@5 | MRR | Avg Relevance (0-10) | Avg Latency (ms) |
|---|---|---|---|---|
| Vector Only | 0.233 | 0.398 | 2.15 | 27 |
| Vector + Graph | 0.233 | 0.398 | 2.15 | 60 |
| Vector + Graph + BM25 | 0.233 | 0.431 | 2.15 | 60 |
| V + G + BM25 + Reranker | 0.233 | 0.469 | 2.15 | 80 |
| Full System (RASPUTIN) | 0.333 | 0.575 | 2.67 | 216 |

## 2. Component Contribution (Δ per component added)

| Component | ΔPrecision@5 | ΔMRR | ΔRelevance |
|---|---|---|---|
| Knowledge Graph | +0.000 | +0.000 | +0.000 |
| BM25 Keyword | +0.000 | +0.033 | +0.000 |
| Neural Reranker | +0.000 | +0.038 | +0.000 |
| Temporal Decay + Multi-factor | +0.100 | +0.106 | +0.514 |

## 3. Per-Category Component Impact (ΔRelevance)

| Category | +Graph | +BM25 | +Reranker | +Temporal |
|---|---|---|---|---|
| Personal Facts | +0.000 | +0.000 | +0.000 | +0.200 |
| Business/Technical | +0.000 | +0.000 | +0.000 | +1.080 |
| Temporal | +0.000 | +0.000 | +0.000 | +0.800 |
| Relational | +0.000 | +0.000 | +0.000 | +1.560 |
| Procedural | +0.000 | +0.000 | +0.000 | +0.000 |
| Cross-Domain | +0.000 | +0.000 | +0.000 | -0.560 |

## 4. Baseline Comparison

| System | Precision@5 | MRR | Avg Relevance | Avg Latency (ms) |
|---|---|---|---|---|
| Vanilla RAG | 0.233 | 0.398 | 2.15 | 25 |
| Mem0-style | 0.240 | 0.413 | 2.10 | 24 |
| Zep/Graphiti-style | 0.233 | 0.398 | 2.15 | 58 |
| **RASPUTIN (Full)** | **0.333** | **0.575** | **2.67** | **216** |

## 5. Key Findings

1. **Most impactful component:** Temporal Decay + Multi-factor (ΔRelevance: +0.514)
2. **Least impactful component:** Knowledge Graph (ΔRelevance: +0.000)
3. **Personal Facts queries** benefit most from Temporal Decay + Multi-factor (Δ+0.200)
3. **Business/Technical queries** benefit most from Temporal Decay + Multi-factor (Δ+1.080)
3. **Temporal queries** benefit most from Temporal Decay + Multi-factor (Δ+0.800)
3. **Relational queries** benefit most from Temporal Decay + Multi-factor (Δ+1.560)

**Overall improvement over Vanilla RAG: +23.9%** (relevance: 2.15 → 2.67)

## 6. Statistical Notes

- Each latency measurement is averaged over 3 trials to reduce noise
- Relevance scored 0-10 using keyword-matching heuristic (automated, not human-judged)
- Precision@5 threshold: relevance ≥ 3 counts as relevant
- MRR computed on first relevant result (relevance ≥ 3)
- Cross-domain queries expected to score lower due to requiring inference beyond stored facts
- Automated relevance scoring may underestimate quality for results that answer queries indirectly