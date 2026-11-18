import client from 'prom-client'

const register = new client.Registry()
client.collectDefaultMetrics({ register })

// Define metrics
export const aiCalls = new client.Counter({ name: 'ai_calls_total', help: 'Total AI calls', labelNames: ['label', 'env', 'model_version'] })
export const aiErrors = new client.Counter({ name: 'ai_errors_total', help: 'Total AI errors', labelNames: ['label', 'env', 'model_version'] })
export const aiLatency = new client.Histogram({ name: 'ai_latency_seconds', help: 'AI latency seconds', labelNames: ['label', 'env', 'model_version'], buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5] })

export const executedOrders = new client.Counter({ name: 'executed_orders_total', help: 'Total executed orders', labelNames: ['env', 'model_version'] })
export const executionAttempts = new client.Counter({ name: 'execution_attempts_total', help: 'Execution attempts', labelNames: ['env'] })
export const executionFailures = new client.Counter({ name: 'execution_failures_total', help: 'Execution failures', labelNames: ['env'] })
export const executionLatency = new client.Histogram({ name: 'execution_latency_seconds', help: 'Execution forward latency seconds', labelNames: ['env'], buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5] })

register.registerMetric(aiCalls)
register.registerMetric(aiErrors)
register.registerMetric(aiLatency)
register.registerMetric(executedOrders)
register.registerMetric(executionAttempts)
register.registerMetric(executionFailures)
register.registerMetric(executionLatency)

export async function metricsHandler(req: any, res: any) {
  try {
    res.setHeader('Content-Type', register.contentType)
    const body = await register.metrics()
    res.status(200).send(body)
  } catch (err: any) {
    res.status(500).send(err?.message || 'error')
  }
}

export default register
