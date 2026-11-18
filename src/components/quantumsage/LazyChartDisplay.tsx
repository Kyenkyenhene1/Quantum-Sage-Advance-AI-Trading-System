"use client"

import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

const ChartDisplay = dynamic(() => import('./ChartDisplay'), {
  ssr: false,
})

export function LazyChartDisplay(props: any) {
  return (
    <Suspense fallback={<div className="h-48 w-full bg-slate-800 animate-pulse" />}> 
      <ChartDisplay {...props} />
    </Suspense>
  )
}

export default LazyChartDisplay
