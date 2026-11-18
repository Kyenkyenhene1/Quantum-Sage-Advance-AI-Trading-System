import * as Sentry from '@sentry/nextjs'

export function initServerSentry() {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
      release: process.env.SENTRY_RELEASE || process.env.GITHUB_SHA || undefined,
      environment: process.env.NODE_ENV || 'development',
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Sentry server init failed', err)
  }
}

export default Sentry
