import type { NextApiRequest, NextApiResponse } from 'next'
import { getAIMetrics, getAIMetricsPrometheus } from '@/lib/aiMetrics'
import { rateLimit } from '@/lib/rateLimit'

// Secure metrics endpoint with bearer token in Authorization header.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = String(req.headers.authorization || '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined
  const apiKeyHeader = req.headers['x-api-key'] || req.query.apiKey

  if (!process.env.AI_METRICS_API_KEY) {
    res.status(403).json({ ok: false, error: 'AI metrics access not configured' })
    return
  }

  const valid = (bearer && bearer === process.env.AI_METRICS_API_KEY) || (apiKeyHeader && apiKeyHeader === process.env.AI_METRICS_API_KEY)
  if (!valid) {
    res.status(401).json({ ok: false, error: 'Unauthorized' })
    return
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous'
  const rl = await rateLimit(String(ip), 60, 60)
  if (!rl.allowed) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({ ok: false, error: 'Too many requests' })
    return
  }

  // support prometheus text format via ?format=prometheus
  const fmt = String(req.query.format || '').toLowerCase()
  if (fmt === 'prometheus') {
    // Prometheus output should only be served to authorized callers (bearer/API key verified above)
    const body = getAIMetricsPrometheus()
    res.setHeader('Content-Type', 'text/plain; version=0.0.4')
    res.status(200).send(body)
    return
  }

  res.status(200).json({ ok: true, metrics: getAIMetrics(), remaining: rl.remaining })
}
