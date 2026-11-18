"use client"

import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

const TradingSignalsCard = dynamic(() => import('./TradingSignalsCard'), { ssr: false })

export default function LazyTradingSignalsCard(props: any) {
  return (
    <Suspense fallback={<div className="h-40 w-full bg-slate-800 animate-pulse" />}>
      <TradingSignalsCard {...props} />
    </Suspense>
  )
}
