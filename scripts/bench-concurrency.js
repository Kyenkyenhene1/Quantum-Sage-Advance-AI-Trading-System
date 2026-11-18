// Simple concurrency benchmark for local testing.
const concurrency = Number(process.env.BENCH_CONCURRENCY || '10')
const tasks = Number(process.env.BENCH_TASKS || '100')

async function runTask(i) {
  // simulate async work (e.g., LLM call)
  const delay = 20 + Math.floor(Math.random() * 100)
  await new Promise((r) => setTimeout(r, delay))
  return i
}

async function run() {
  console.log(`Starting bench: tasks=${tasks} concurrency=${concurrency}`)
  const start = Date.now()
  let inFlight = 0
  let index = 0
  const results = []

  async function next() {
    if (index >= tasks) return
    const i = index++
    inFlight++
    try {
      const r = await runTask(i)
      results.push(r)
    } finally {
      inFlight--
      if (index < tasks) await next()
    }
  }

  const starters = Math.min(concurrency, tasks)
  await Promise.all(Array.from({ length: starters }, () => next()))
  const took = Date.now() - start
  console.log(`Completed ${results.length}/${tasks} tasks in ${took}ms`)
}

run().catch((e) => {
  console.error('bench failed', e)
  process.exit(1)
})
