// Server-side Sentry configuration
const Sentry = require('@sentry/nextjs')

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
  // Adjust integrations or beforeSend here if needed
})

module.exports = Sentry
