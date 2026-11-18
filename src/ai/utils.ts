export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 500
): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const wait = delayMs * Math.pow(2, i)
      // eslint-disable-next-line no-console
      console.warn(`Retry ${i + 1} failed, waiting ${wait}ms`, err)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
}
