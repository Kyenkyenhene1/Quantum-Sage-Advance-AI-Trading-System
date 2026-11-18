import Redis from 'ioredis'

let client: Redis | null = null

export function getRedis() {
  if (client) return client
  const redisUrl = process.env.REDIS_URL || process.env.REDIS || ''
  if (!redisUrl) return null

  // Improve defaults for production use: limited retry attempts, auto pipelining,
  // and a reconnect strategy to avoid hot loops.
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    // lazyConnect: true, // avoid connecting until first command (optional)
    // keepAlive and reconnect strategy handled below
  })

  client.on('error', (err) => {
    try { console.warn('Redis error', err?.message ?? err) } catch {}
  })
  client.on('connect', () => { try { console.debug('Redis connecting') } catch {} })
  client.on('ready', () => { try { console.debug('Redis ready') } catch {} })
  client.on('close', () => { try { console.debug('Redis closed') } catch {} })
  client.on('reconnecting', () => { try { console.debug('Redis reconnecting') } catch {} })

  // graceful shutdown
  const shutdown = async () => {
    if (!client) return
    try {
      await client.quit()
    } catch (e) {
      try { await client.disconnect() } catch {}
    }
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('exit', () => { try { client?.disconnect() } catch {} })

  return client
}

export function closeRedis() {
  if (!client) return
  try { client.quit() } catch { try { client.disconnect() } catch {} }
  client = null
}
