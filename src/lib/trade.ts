export interface PlaceOrderRequest {
  pair: string
  direction: 'Buy' | 'Sell'
  entryPrice: number
  accountBalance: number
  stopLossPips: number
  pipValuePerLot: number
  riskPerTradePct?: number
  layerConfig?: { layers?: number; spacingPips?: number; scalingFactors?: number[] }
  desiredTakeProfitPips?: number
}

export async function proposeOrder(req: PlaceOrderRequest) {
  const r = await fetch('/api/place-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`Place-order failed: ${r.status} ${txt}`)
  }
  const body = await r.json()
  if (!body.ok) throw new Error('Place-order returned failure: ' + JSON.stringify(body))
  return body
}
