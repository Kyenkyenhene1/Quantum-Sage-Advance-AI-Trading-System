import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'

const dbPath = path.join('logs', `audit.test.db.${Date.now()}.sqlite`)
process.env.AUDIT_DB_PATH = dbPath

let audit: any

beforeAll(async () => {
  audit = await import('../../src/lib/audit')
})

afterAll(async () => {
  try {
    const p = path.resolve(process.cwd(), dbPath)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch (e) {
    // ignore
  }
})

describe('DB-backed audit logger', () => {
  it('writes and reads using SQLite DB', async () => {
    const ok = await audit.logExecution({ accountId: 'db-acct', action: 'db-test', payload: { x: 1 }, status: 'attempt' })
    expect(ok).toBe(true)
    const lines = await audit.readAuditLines(10)
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines[0].accountId === 'db-acct' || lines[lines.length - 1].accountId === 'db-acct').toBe(true)
  })
})
