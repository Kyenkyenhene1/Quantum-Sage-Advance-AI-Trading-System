import { metricsHandler } from '@/lib/metrics'

export default async function handler(req: any, res: any) {
  // Basic protection: allow a metrics API key if configured
  const key = process.env.METRICS_API_KEY
  if (key) {
    const auth = String(req.headers['x-api-key'] || req.headers.authorization || '')
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth
    if (bearer !== key) {
      res.status(401).json({ ok: false, error: 'Unauthorized' })
      return
    }
  }
  return metricsHandler(req, res)
}
