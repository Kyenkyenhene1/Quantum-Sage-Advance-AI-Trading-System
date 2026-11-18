import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

let sdk: NodeSDK | null = null

export function initTracing(serviceName = 'quantumsage-app') {
  if (sdk) return sdk
  sdk = new NodeSDK({
    traceExporter: new ConsoleSpanExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
    serviceName,
  })
  sdk.start().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('Tracing start failed', e)
  })
  return sdk
}

export async function shutdownTracing() {
  if (!sdk) return
  try {
    await sdk.shutdown()
  } catch (e) {
    // ignore
  }
}
