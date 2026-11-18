class Semaphore {
  private max: number
  private current = 0
  private queue: Array<() => void> = []

  constructor(max: number) {
    this.max = Math.max(1, Math.floor(max))
  }

  async acquire(): Promise<() => void> {
    if (this.current < this.max) {
      this.current += 1
      let released = false
      return () => {
        if (released) return
        released = true
        this.current -= 1
        const next = this.queue.shift()
        if (next) next()
      }
    }
    return new Promise<() => void>(resolve => {
      this.queue.push(() => {
        this.current += 1
        let released = false
        resolve(() => {
          if (released) return
          released = true
          this.current -= 1
          const next = this.queue.shift()
          if (next) next()
        })
      })
    })
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }
}

const max = Number(process.env.AI_MAX_CONCURRENCY || '5')
const sem = new Semaphore(max)

export async function withAIConcurrency<T>(fn: () => Promise<T>) {
  return sem.run(fn)
}

export function getConcurrencyLimit() {
  return max
}

export default { withAIConcurrency, getConcurrencyLimit }
