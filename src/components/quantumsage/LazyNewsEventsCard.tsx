"use client"

import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

const NewsEventsCard = dynamic(() => import('./NewsEventsCard'), { ssr: false })

export default function LazyNewsEventsCard(props: any) {
  return (
    <Suspense fallback={<div className="h-40 w-full bg-slate-800 animate-pulse" />}>
      <NewsEventsCard {...props} />
    </Suspense>
  )
}
