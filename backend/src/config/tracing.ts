import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { env } from './env';

export function initTracing() {
  // Only initialize tracing if OTEL_EXPORTER_OTLP_ENDPOINT is set and not in test
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT || env.NODE_ENV === 'test') {
    return;
  }

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'nexclass-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      environment: env.NODE_ENV,
    })
  );

  const provider = new NodeTracerProvider({
    resource,
  });

  // Export traces to Jaeger/Tempo via OTLP
  const exporter = new OTLPTraceExporter({
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));

  // Auto-instrument common libraries
  registerInstrumentations({
    instrumentations: [getNodeAutoInstrumentations()],
    tracerProvider: provider,
  });

  provider.register();
}

