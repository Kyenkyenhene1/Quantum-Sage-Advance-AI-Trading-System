"use client"

import { useEffect } from 'react'
import initSentry from '@/lib/sentry'

export default function SentryInit() {
  useEffect(() => {
    try {
      initSentry()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Sentry init failed', err)
    }
  }, [])

  return null
}
