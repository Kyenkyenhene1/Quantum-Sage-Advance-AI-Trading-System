import fs from 'fs'
import path from 'path'

const betterSqlite3 = require('better-sqlite3')

export type AuditEntry = {
  timestamp?: string
  accountId?: string
  action?: string
  payload?: any
  executorResponse?: any
  status?: 'ok' | 'error' | 'attempt'
  sentryEventId?: string | null
}

let db: any = null
let insertStmt: any = null

export function initAuditDb(dbPath?: string) {
  const p = dbPath ? path.resolve(process.cwd(), dbPath) : path.resolve(process.cwd(), 'logs', 'audit.db')
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  db = new betterSqlite3(p)
  db.pragma('journal_mode = WAL')
  // reduce sync overhead for higher throughput; WAL + synchronous=NORMAL is a
  // reasonable tradeoff for many audit workloads. Adjust if durability needs
  // are stricter.
  try { db.pragma('synchronous = NORMAL') } catch {}
  db.prepare(
    `CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      accountId TEXT,
      action TEXT,
      payload TEXT,
      executorResponse TEXT,
      status TEXT,
      sentryEventId TEXT
    )`
  ).run()
  // prepare insert statement once for performance
  insertStmt = db.prepare('INSERT INTO audit (timestamp, accountId, action, payload, executorResponse, status, sentryEventId) VALUES (?, ?, ?, ?, ?, ?, ?)')
}

export async function logExecutionDb(entry: AuditEntry) {
  if (!db) initAuditDb(process.env.AUDIT_DB_PATH)
  try {
    if (!insertStmt) initAuditDb(process.env.AUDIT_DB_PATH)
    insertStmt.run(entry.timestamp || new Date().toISOString(), entry.accountId || null, entry.action || null, JSON.stringify(entry.payload || null), JSON.stringify(entry.executorResponse || null), entry.status || null, entry.sentryEventId || null)
    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('logExecutionDb failed', err)
    return false
  }
}

export async function readAuditLinesDb(limit = 100) {
  if (!db) initAuditDb(process.env.AUDIT_DB_PATH)
  try {
    const rows = db.prepare('SELECT timestamp, accountId, action, payload, executorResponse, status, sentryEventId FROM audit ORDER BY id DESC LIMIT ?').all(limit)
    return rows.map((r: any) => ({
      timestamp: r.timestamp,
      accountId: r.accountId,
      action: r.action,
      payload: r.payload ? JSON.parse(r.payload) : null,
      executorResponse: r.executorResponse ? JSON.parse(r.executorResponse) : null,
      status: r.status,
      sentryEventId: r.sentryEventId,
    }))
  } catch (err) {
    return []
  }
}
