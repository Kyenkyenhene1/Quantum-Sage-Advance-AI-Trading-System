import { Pool } from 'pg'

export type AuditEntry = {
  timestamp?: string
  accountId?: string
  action?: string
  payload?: any
  executorResponse?: any
  status?: 'ok' | 'error' | 'attempt'
  sentryEventId?: string | null
}

let pool: Pool | null = null
let prepared: any = null

export function initAuditPg(pgUrl?: string) {
  const url = pgUrl || process.env.AUDIT_PG_URL
  if (!url) throw new Error('AUDIT_PG_URL not configured')
  pool = new Pool({ connectionString: url, max: Number(process.env.AUDIT_PG_POOL_MAX || '10'), idleTimeoutMillis: 30000 })
  // create table if not exists
  const create = `CREATE TABLE IF NOT EXISTS audit (
    id bigserial primary key,
    timestamp timestamptz,
    accountId text,
    action text,
    payload jsonb,
    executorResponse jsonb,
    status text,
    sentryEventId text
  )`
  return pool.query(create).then(() => true)
}

export async function logExecutionPg(entry: AuditEntry) {
  if (!pool) await initAuditPg()
  try {
    const q = 'INSERT INTO audit (timestamp, accountId, action, payload, executorResponse, status, sentryEventId) VALUES ($1,$2,$3,$4,$5,$6,$7)'
    const vals = [entry.timestamp || new Date().toISOString(), entry.accountId || null, entry.action || null, entry.payload || null, entry.executorResponse || null, entry.status || null, entry.sentryEventId || null]
    await pool!.query(q, vals)
    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('logExecutionPg failed', err)
    return false
  }
}

export async function readAuditPg(limit = 100) {
  if (!pool) await initAuditPg()
  try {
    const r = await pool!.query('SELECT timestamp, accountId, action, payload, executorResponse, status, sentryEventId FROM audit ORDER BY id DESC LIMIT $1', [limit])
    return r.rows
  } catch (err) {
    return []
  }
}
