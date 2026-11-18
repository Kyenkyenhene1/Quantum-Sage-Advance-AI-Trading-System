#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const betterSqlite3 = require('better-sqlite3')

const p = process.argv[2] || path.join('logs', 'audit.db')
const dir = path.dirname(p)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
const db = new betterSqlite3(p)
db.pragma('journal_mode = WAL')
db.prepare(`CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  accountId TEXT,
  action TEXT,
  payload TEXT,
  executorResponse TEXT,
  status TEXT,
  sentryEventId TEXT
)`).run()
console.log('Audit DB initialized at', p)
