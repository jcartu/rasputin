import { Page } from '@playwright/test';

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  memoryUsage?: number;
  jsHeapSize?: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  p95: number;
  p99: number;
}

export class PerformanceHelper {
  constructor(private page: Page) {}

  async getMetrics(): Promise<PerformanceMetrics> {
    const metrics = await this.page.evaluate(() => {
      const perf = window.performance;
      const timing = perf.timing;
      const entries = perf.getEntriesByType('paint');
      const lcpEntries = perf.getEntriesByType('largest-contentful-paint');

      const firstPaint = entries.find((e) => e.name === 'first-paint');
      const fcp = entries.find((e) => e.name === 'first-contentful-paint');
      const lcp = lcpEntries[lcpEntries.length - 1] as PerformanceEntry | undefined;

      let memoryUsage: number | undefined;
      let jsHeapSize: number | undefined;

      if (
        (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } })
          .memory
      ) {
        const mem = (
          performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }
        ).memory;
        memoryUsage = mem.usedJSHeapSize;
        jsHeapSize = mem.totalJSHeapSize;
      }

      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: firstPaint?.startTime || 0,
        firstContentfulPaint: fcp?.startTime || 0,
        largestContentfulPaint: lcp?.startTime || 0,
        timeToInteractive: timing.domInteractive - timing.navigationStart,
        totalBlockingTime: 0,
        cumulativeLayoutShift: 0,
        memoryUsage,
        jsHeapSize,
      };
    });

    return metrics;
  }

  async measureAction(actionFn: () => Promise<void>): Promise<number> {
    const start = Date.now();
    await actionFn();
    return Date.now() - start;
  }

  async benchmark(
    name: string,
    actionFn: () => Promise<void>,
    iterations = 10
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const duration = await this.measureAction(actionFn);
      times.push(duration);
      await this.page.waitForTimeout(100);
    }

    times.sort((a, b) => a - b);

    const sum = times.reduce((a, b) => a + b, 0);
    const mean = sum / times.length;
    const median = times[Math.floor(times.length / 2)];
    const min = times[0];
    const max = times[times.length - 1];

    const squaredDiffs = times.map((t) => Math.pow(t - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    const p95Index = Math.floor(times.length * 0.95);
    const p99Index = Math.floor(times.length * 0.99);

    return {
      name,
      iterations,
      mean: Math.round(mean),
      median: Math.round(median),
      min: Math.round(min),
      max: Math.round(max),
      stdDev: Math.round(stdDev),
      p95: Math.round(times[p95Index] || max),
      p99: Math.round(times[p99Index] || max),
    };
  }

  async waitForNetworkIdle(timeout = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  async measureNetworkRequests(actionFn: () => Promise<void>): Promise<{
    count: number;
    totalSize: number;
    totalTime: number;
  }> {
    const requests: { size: number; time: number }[] = [];

    const handler = (response: Awaited<ReturnType<Page['waitForResponse']>>) => {
      const headers = response.headers();
      const size = parseInt(headers['content-length'] || '0', 10);
      requests.push({
        size,
        time: 0,
      });
    };

    this.page.on('response', handler);

    await actionFn();
    await this.waitForNetworkIdle();

    this.page.off('response', handler);

    return {
      count: requests.length,
      totalSize: requests.reduce((sum, r) => sum + r.size, 0),
      totalTime: requests.reduce((sum, r) => sum + r.time, 0),
    };
  }

  assertPerformance(metrics: PerformanceMetrics, thresholds: Partial<PerformanceMetrics>): void {
    const errors: string[] = [];

    for (const [key, maxValue] of Object.entries(thresholds)) {
      const actualValue = metrics[key as keyof PerformanceMetrics];
      if (
        typeof actualValue === 'number' &&
        typeof maxValue === 'number' &&
        actualValue > maxValue
      ) {
        errors.push(`${key}: ${actualValue}ms exceeds threshold of ${maxValue}ms`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Performance thresholds exceeded:\n${errors.join('\n')}`);
    }
  }
}
