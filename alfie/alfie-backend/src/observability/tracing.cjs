/**
 * OpenTelemetry Tracing Setup (CommonJS)
 * Must be loaded via --require before app starts for proper instrumentation
 */

'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchSpanProcessor, ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

// Load environment variables
require('dotenv').config();

// Configuration from environment
const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false';
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'alfie-backend';
const OTEL_SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || '1.0.0';
const OTEL_ENVIRONMENT = process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV || 'development';
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const OTEL_DEBUG = process.env.OTEL_DEBUG === 'true';
const OTEL_CONSOLE_EXPORTER = process.env.OTEL_CONSOLE_EXPORTER === 'true';

if (!OTEL_ENABLED) {
  console.log('[OpenTelemetry] Disabled via OTEL_ENABLED=false');
  module.exports = { sdk: null };
} else {

// Enable debug logging if requested
if (OTEL_DEBUG) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// Create resource with service information
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: OTEL_SERVICE_NAME,
  [SemanticResourceAttributes.SERVICE_VERSION]: OTEL_SERVICE_VERSION,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: OTEL_ENVIRONMENT,
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'alfie',
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || `${OTEL_SERVICE_NAME}-${process.pid}`,
});

// Configure trace exporter
const traceExporter = OTEL_CONSOLE_EXPORTER
  ? new ConsoleSpanExporter()
  : new OTLPTraceExporter({
      url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

// Configure metric exporter
const metricExporter = new OTLPMetricExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
    ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
    : {},
});

// Create metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || '30000', 10),
});

// Initialize the SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Enable all auto-instrumentations with sensible defaults
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Ignore health check endpoints to reduce noise
          const ignorePaths = ['/health', '/ready', '/live', '/metrics'];
          return ignorePaths.some(path => req.url?.includes(path));
        },
        requestHook: (span, request) => {
          // Add custom attributes to HTTP spans
          if (request.headers) {
            const requestId = request.headers['x-request-id'];
            if (requestId) {
              span.setAttribute('http.request_id', requestId);
            }
          }
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-ws': {
        enabled: true,
      },
      // Disable some noisy instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
    }),
  ],
  spanProcessor: new BatchSpanProcessor(traceExporter, {
    maxQueueSize: parseInt(process.env.OTEL_BATCH_SIZE || '2048', 10),
    maxExportBatchSize: parseInt(process.env.OTEL_BATCH_EXPORT_SIZE || '512', 10),
    scheduledDelayMillis: parseInt(process.env.OTEL_BATCH_DELAY || '5000', 10),
    exportTimeoutMillis: parseInt(process.env.OTEL_EXPORT_TIMEOUT || '30000', 10),
  }),
});

// Start the SDK
sdk.start();

console.log(`[OpenTelemetry] Initialized - Service: ${OTEL_SERVICE_NAME} v${OTEL_SERVICE_VERSION} (${OTEL_ENVIRONMENT})`);
console.log(`[OpenTelemetry] Exporting to: ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

// Graceful shutdown
const shutdown = async () => {
  console.log('[OpenTelemetry] Shutting down...');
  try {
    await sdk.shutdown();
    console.log('[OpenTelemetry] Shutdown complete');
  } catch (error) {
    console.error('[OpenTelemetry] Shutdown error:', error);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { sdk };
}
