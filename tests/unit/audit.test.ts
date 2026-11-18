import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

process.env.AUDIT_LOG_PATH = path.join('logs', `audit.test.${Date.now()}.log`)

let audit: any

beforeEach(async () => {
  audit = await import('../../src/lib/audit')
})

afterEach(async () => {
  try {
    const p = path.resolve(process.cwd(), process.env.AUDIT_LOG_PATH!)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch (e) {
    // ignore
  }
})

describe('audit logger', () => {
  it('writes and reads entries', async () => {
    const ok = await audit.logExecution({ accountId: 'acct1', action: 'test', payload: { a: 1 }, status: 'attempt' })
    expect(ok).toBe(true)
    const lines = await audit.readAuditLines(10)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines[lines.length - 1].accountId).toBe('acct1')
  })
})
