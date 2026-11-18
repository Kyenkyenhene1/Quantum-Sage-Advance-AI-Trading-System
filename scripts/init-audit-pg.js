#!/usr/bin/env node
const { Client } = require('pg')
const url = process.argv[2] || process.env.AUDIT_PG_URL
if (!url) {
  console.error('Usage: init-audit-pg.js <connection-string>')
  process.exit(2)
}
;(async () => {
  const c = new Client({ connectionString: url })
  await c.connect()
  await c.query(`CREATE TABLE IF NOT EXISTS audit (
    id bigserial primary key,
    timestamp timestamptz,
    accountId text,
    action text,
    payload jsonb,
    executorResponse jsonb,
    status text,
    sentryEventId text
  )`)
  await c.end()
  console.log('Audit PG initialized')
})().catch(e => { console.error(e); process.exit(2) })
