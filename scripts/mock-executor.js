const http = require('http')

const port = process.env.MOCK_EXECUTOR_PORT || 4001

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => {
      console.log('[mock-executor] received', data.slice(0, 1000))
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true, executed: true, id: Math.floor(Math.random()*1000000) }))
    })
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

server.listen(port, () => console.log(`[mock-executor] listening on http://localhost:${port}`))
