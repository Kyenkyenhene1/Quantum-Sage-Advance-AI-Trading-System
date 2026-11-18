type MetricsRecord = {
  calls: number
  errors: number
  totalLatencyMs: number
}

// key is label|modelVersion (if provided)
const metrics = new Map<string, MetricsRecord>()
let executedOrders = 0

export function recordAICallStart(label: string, modelVersion?: string) {
  const now = Date.now()
  return { label: modelVersion ? `${label}|${modelVersion}` : label, start: now }
}

export function recordAICallEnd(ctx: { label: string; start: number }, err?: unknown) {
  const ms = Date.now() - ctx.start
  const rec = metrics.get(ctx.label) || { calls: 0, errors: 0, totalLatencyMs: 0 }
  rec.calls += 1
  rec.totalLatencyMs += ms
  if (err) rec.errors += 1
  metrics.set(ctx.label, rec)
  // Basic emission: console log. Replace with real metrics exporter later.
  // eslint-disable-next-line no-console
  console.info(`AI metrics | ${ctx.label} | latency=${ms}ms | error=${err ? '1' : '0'}`)
}

export function getAIMetrics() {
  const out: Record<string, MetricsRecord & { avgLatencyMs: number }> = {}
  metrics.forEach((v, k) => {
    out[k] = { ...v, avgLatencyMs: v.calls ? v.totalLatencyMs / v.calls : 0 }
  })
  return { metrics: out, executedOrders }
}

export function getAIMetricsPrometheus() {
  // Very small prometheus exporter: metric names:
  // ai_calls_total{label="..."} ai_errors_total{label="..."} ai_latency_ms_sum{label="..."}
  const env = process.env.NODE_ENV || 'development'
  const modelVersion = process.env.AI_MODEL_VERSION || 'unknown'
  let lines: string[] = []
  metrics.forEach((v, k) => {
    const label = k.replace(/"/g, '\\"')
    const meta = `label=\"${label}\",env=\"${env}\",model_version=\"${modelVersion}\"`
    lines.push(`ai_calls_total{${meta}} ${v.calls}`)
    lines.push(`ai_errors_total{${meta}} ${v.errors}`)
    lines.push(`ai_latency_ms_sum{${meta}} ${v.totalLatencyMs}`)
  })
  // executed orders metric
  lines.push(`executed_orders_total{env="${env}",model_version="${modelVersion}"} ${executedOrders}`)
  return lines.join('\n')
}

export function recordExecutedOrder() {
  executedOrders += 1
}
