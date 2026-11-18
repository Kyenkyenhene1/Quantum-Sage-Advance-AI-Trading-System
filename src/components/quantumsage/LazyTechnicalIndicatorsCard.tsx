"use client"

import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

const TechnicalIndicatorsCard = dynamic(() => import('./TechnicalIndicatorsCard'), { ssr: false })

export default function LazyTechnicalIndicatorsCard(props: any) {
  return (
    <Suspense fallback={<div className="h-40 w-full bg-slate-800 animate-pulse" />}>
      <TechnicalIndicatorsCard {...props} />
    </Suspense>
  )
}
