/**
 * REST API Wrapper for ALFIE Integration
 * Provides simple HTTP endpoints for consensus and synthesis
 * Bypasses authentication for internal ALFIE calls
 */

import express, { Request, Response } from "express";
import { generateConsensus } from "./services/consensus";
import { generateSynthesis } from "./services/synthesis";
import type { SpeedTier } from "../shared/rasputin";

const router = express.Router();

// Middleware to parse JSON
router.use(express.json());

/**
 * POST /api/alfie/consensus
 * Run multi-model consensus query
 */
router.post("/consensus", async (req: Request, res: Response) => {
  try {
    const {
      query,
      speedTier = "normal",
      selectedModels,
      conversationHistory,
    } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(
      `[ALFIE→Rasputin] Consensus request: "${query.slice(0, 100)}..." (tier: ${speedTier})`
    );

    const result = await generateConsensus({
      query,
      speedTier: speedTier as SpeedTier,
      selectedModels,
      conversationHistory,
    });

    return res.json(result);
  } catch (error) {
    console.error("[ALFIE→Rasputin] Consensus error:", error);
    return res.status(500).json({
      error: "Consensus generation failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/alfie/synthesis
 * Run full 5-stage synthesis pipeline
 */
router.post("/synthesis", async (req: Request, res: Response) => {
  try {
    const { query, speedTier = "normal", conversationHistory } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log(
      `[ALFIE→Rasputin] Synthesis request: "${query.slice(0, 100)}..." (tier: ${speedTier})`
    );

    const result = await generateSynthesis({
      query,
      speedTier: speedTier as SpeedTier,
      conversationHistory,
    });

    return res.json(result);
  } catch (error) {
    console.error("[ALFIE→Rasputin] Synthesis error:", error);
    return res.status(500).json({
      error: "Synthesis generation failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/alfie/health
 * Health check for ALFIE integration
 */
router.get("/health", (_req: Request, res: Response) => {
  return res.json({
    status: "ok",
    service: "rasputin-alfie-integration",
    timestamp: new Date().toISOString(),
  });
});

export default router;
