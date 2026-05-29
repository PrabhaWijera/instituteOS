import * as os from 'os';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

/**
 * Initialize OpenTelemetry distributed tracing
 * Exports spans to Jaeger via OTLP HTTP protocol
 */
export function initializeOpenTelemetry() {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'nexclass-backend',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'nexclass',
      environment: process.env.NODE_ENV || 'development',
      hostname: os.hostname(),
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${otelEndpoint}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-net': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('OpenTelemetry SDK shut down successfully'))
      .catch((err) => console.error('Failed to shut down OpenTelemetry SDK', err))
      .finally(() => process.exit(0));
  });

  return sdk;
}

export default initializeOpenTelemetry;

