import fs from 'fs'
import path from 'path'
import { logExecutionDb, readAuditLinesDb, initAuditDb } from './auditDb'
import { logExecutionPg, readAuditPg, initAuditPg } from './auditPg'

export type AuditEntry = {
  timestamp?: string
  accountId?: string
  action?: string
  payload?: any
  executorResponse?: any
  status?: 'ok' | 'error' | 'attempt'
  sentryEventId?: string | null
}

const defaultPath = path.resolve(process.cwd(), process.env.AUDIT_LOG_PATH || 'logs/executions.log')

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function writeFileEntry(entry: AuditEntry) {
  const file = process.env.AUDIT_LOG_PATH ? path.resolve(process.cwd(), process.env.AUDIT_LOG_PATH) : defaultPath
  try {
    ensureDir(file)
    const out = Object.assign({ timestamp: new Date().toISOString() }, entry)
    await fs.promises.appendFile(file, JSON.stringify(out) + '\n', { encoding: 'utf8' })
    return true
  } catch (err) {
    // best-effort: swallow errors but return false
    // eslint-disable-next-line no-console
    console.warn('audit.logExecution failed', err)
    return false
  }
}

export async function logExecution(entry: AuditEntry) {
  // Priority order:
  // 1. If AUDIT_PG_URL is set use Postgres
  // 2. Else if AUDIT_DB_PATH is set use SQLite
  // 3. Else fallback to file JSONL
  if (process.env.AUDIT_PG_URL) {
    try {
      await initAuditPg(process.env.AUDIT_PG_URL)
      return await logExecutionPg(entry)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('audit PG write failed, falling back', err)
    }
  }
  if (process.env.AUDIT_DB_PATH) {
    try {
      initAuditDb(process.env.AUDIT_DB_PATH)
      return await logExecutionDb(entry)
    } catch (err) {
      // fallback to file
      // eslint-disable-next-line no-console
      console.warn('audit DB write failed, falling back to file', err)
      return await writeFileEntry(entry)
    }
  }
  return await writeFileEntry(entry)
}

export async function readAuditLines(limit = 100) {
  if (process.env.AUDIT_PG_URL) {
    try {
      await initAuditPg(process.env.AUDIT_PG_URL)
      return await readAuditPg(limit)
    } catch (err) {
      // fallback
      // eslint-disable-next-line no-console
      console.warn('audit PG read failed, falling back', err)
    }
  }
  if (process.env.AUDIT_DB_PATH) {
    try {
      initAuditDb(process.env.AUDIT_DB_PATH)
      return await readAuditLinesDb(limit)
    } catch (err) {
      // fallback to file
      // eslint-disable-next-line no-console
      console.warn('audit DB read failed, falling back to file', err)
    }
  }
  const file = process.env.AUDIT_LOG_PATH ? path.resolve(process.cwd(), process.env.AUDIT_LOG_PATH) : defaultPath
  try {
    const txt = await fs.promises.readFile(file, { encoding: 'utf8' })
    const lines = txt.trim().split('\n').filter(Boolean)
    return lines.slice(-limit).map(l => JSON.parse(l))
  } catch (err) {
    return []
  }
}
