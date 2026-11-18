// Simple health check endpoint for deployment probes.
import type { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Basic app liveness
  const payload: Record<string, unknown> = { ok: true, timestamp: Date.now() }

  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    let client: Redis | null = null
    try {
      client = new Redis(redisUrl)
      const pong = await client.ping()
      payload.redis = { ok: pong === 'PONG' }
    } catch (err) {
      payload.redis = { ok: false, error: String(err) }
      res.status(503).json(payload)
      return
    } finally {
      try {
        if (client) await client.quit()
      } catch (e) {
        // ignore
      }
    }
  }

  res.status(200).json(payload)
}
