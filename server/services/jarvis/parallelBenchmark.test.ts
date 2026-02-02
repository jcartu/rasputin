import { describe, it, expect } from "vitest";

const simulateToolExecution = async (
  toolName: string,
  durationMs: number
): Promise<{ tool: string; duration: number; timestamp: number }> => {
  const start = Date.now();
  await new Promise(resolve => setTimeout(resolve, durationMs));
  return {
    tool: toolName,
    duration: durationMs,
    timestamp: Date.now() - start,
  };
};

describe("Parallel vs Sequential Execution Benchmark", () => {
  const toolDurations = [
    { name: "web_search_1", duration: 100 },
    { name: "web_search_2", duration: 150 },
    { name: "web_search_3", duration: 120 },
    { name: "read_file", duration: 50 },
    { name: "analyze_data", duration: 200 },
  ];

  it("measures sequential execution time", async () => {
    const start = Date.now();

    const results: Array<{
      tool: string;
      duration: number;
      timestamp: number;
    }> = [];
    for (const tool of toolDurations) {
      const result = await simulateToolExecution(tool.name, tool.duration);
      results.push(result);
    }

    const totalTime = Date.now() - start;
    const expectedMin = toolDurations.reduce((sum, t) => sum + t.duration, 0);

    console.log(
      `Sequential execution: ${totalTime}ms (expected ~${expectedMin}ms)`
    );

    expect(results.length).toBe(5);
    expect(totalTime).toBeGreaterThanOrEqual(expectedMin - 50);
  });

  it("measures parallel execution time", async () => {
    const start = Date.now();

    const results = await Promise.all(
      toolDurations.map(tool => simulateToolExecution(tool.name, tool.duration))
    );

    const totalTime = Date.now() - start;
    const maxDuration = Math.max(...toolDurations.map(t => t.duration));

    console.log(
      `Parallel execution: ${totalTime}ms (expected ~${maxDuration}ms)`
    );

    expect(results.length).toBe(5);
    expect(totalTime).toBeLessThan(maxDuration + 100);
  });

  it("verifies parallel is faster than sequential for independent tasks", async () => {
    const sequentialStart = Date.now();
    for (const tool of toolDurations) {
      await simulateToolExecution(tool.name, tool.duration);
    }
    const sequentialTime = Date.now() - sequentialStart;

    const parallelStart = Date.now();
    await Promise.all(
      toolDurations.map(tool => simulateToolExecution(tool.name, tool.duration))
    );
    const parallelTime = Date.now() - parallelStart;

    const speedup = sequentialTime / parallelTime;
    const percentOfSequential = (parallelTime / sequentialTime) * 100;

    console.log(`Sequential: ${sequentialTime}ms`);
    console.log(`Parallel: ${parallelTime}ms`);
    console.log(`Speedup: ${speedup.toFixed(2)}x`);
    console.log(
      `Parallel is ${percentOfSequential.toFixed(1)}% of sequential time`
    );

    expect(parallelTime).toBeLessThan(sequentialTime);
    expect(percentOfSequential).toBeLessThan(50);
  });

  it("simulates real-world mixed workload with dependencies", async () => {
    const parallelPhase1 = [
      { name: "web_search_news", duration: 150 },
      { name: "web_search_academic", duration: 180 },
      { name: "web_search_social", duration: 120 },
    ];

    const sequentialPhase = [{ name: "analyze_results", duration: 100 }];

    const parallelPhase2 = [
      { name: "generate_chart", duration: 80 },
      { name: "format_report", duration: 60 },
    ];

    const start = Date.now();

    await Promise.all(
      parallelPhase1.map(t => simulateToolExecution(t.name, t.duration))
    );
    const phase1Time = Date.now() - start;

    for (const t of sequentialPhase) {
      await simulateToolExecution(t.name, t.duration);
    }
    const phase2Time = Date.now() - start;

    await Promise.all(
      parallelPhase2.map(t => simulateToolExecution(t.name, t.duration))
    );
    const totalTime = Date.now() - start;

    const totalDurations = [
      ...parallelPhase1,
      ...sequentialPhase,
      ...parallelPhase2,
    ].reduce((sum, t) => sum + t.duration, 0);

    const expectedParallel =
      Math.max(...parallelPhase1.map(t => t.duration)) +
      sequentialPhase.reduce((sum, t) => sum + t.duration, 0) +
      Math.max(...parallelPhase2.map(t => t.duration));

    console.log(`Mixed workload total: ${totalTime}ms`);
    console.log(`If fully sequential: ~${totalDurations}ms`);
    console.log(`Expected with parallelism: ~${expectedParallel}ms`);
    console.log(
      `Efficiency: ${((expectedParallel / totalDurations) * 100).toFixed(1)}% of sequential time`
    );

    expect(totalTime).toBeLessThan(totalDurations);
    expect(totalTime).toBeLessThan(expectedParallel + 100);
  });
});
