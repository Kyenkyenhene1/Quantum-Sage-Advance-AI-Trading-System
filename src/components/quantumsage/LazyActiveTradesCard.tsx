"use client"

import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

const ActiveTradesCard = dynamic(() => import('./ActiveTradesCard'), { ssr: false })

export default function LazyActiveTradesCard(props: any) {
  return (
    <Suspense fallback={<div className="h-48 w-full bg-slate-800 animate-pulse" />}>
      <ActiveTradesCard {...props} />
    </Suspense>
  )
}
