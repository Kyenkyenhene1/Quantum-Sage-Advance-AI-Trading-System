"use client"

import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

const SystemLogsCard = dynamic(() => import('./SystemLogsCard'), { ssr: false })

export default function LazySystemLogsCard(props: any) {
  return (
    <Suspense fallback={<div className="h-32 w-full bg-slate-800 animate-pulse" />}>
      <SystemLogsCard {...props} />
    </Suspense>
  )
}
