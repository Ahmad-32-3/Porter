import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { runCrowd, type CrowdResult, type Tick } from '../sim/porterSim'

const TICK_MS = 40

export type LivePoint = { time: number; value: number }

export function useCrowdPlayback() {
  const reduced = Boolean(useReducedMotion())
  const [result, setResult] = useState<CrowdResult | null>(null)
  const [cursor, setCursor] = useState(0)
  const [paused, setPaused] = useState(true)
  const [t0, setT0] = useState(0)

  function run() {
    const next = runCrowd()
    setT0(Date.now() / 1000)
    setResult(next)
    if (reduced) {
      setCursor(next.series.length - 1)
      setPaused(true)
      return
    }
    setCursor(0)
    setPaused(false)
  }

  useEffect(() => {
    if (!result || paused) return
    if (cursor >= result.series.length - 1) {
      setPaused(true)
      return
    }
    const id = window.setTimeout(() => setCursor((c) => c + 1), TICK_MS)
    return () => window.clearTimeout(id)
  }, [result, cursor, paused])

  const tick: Tick | null = result ? (result.series[Math.min(cursor, result.series.length - 1)] ?? null) : null

  const live = useMemo(() => {
    if (!result) return { grades: [] as LivePoint[], tax: [] as LivePoint[] }
    const slice = result.series.slice(0, cursor + 1)
    const step = TICK_MS / 1000
    return {
      grades: slice.map((s) => ({ time: t0 + s.t * step, value: s.grades })),
      tax: slice.map((s) => ({ time: t0 + s.t * step, value: s.tax })),
    }
  }, [result, cursor, t0])

  const funnelTick = paused && result ? (result.series[result.peakWaitTick] ?? tick) : tick
  const gaugeTick = paused && result ? (result.series[result.peakSlotsTick] ?? tick) : tick

  return { result, tick, funnelTick, gaugeTick, live, paused, run, reduced, cursor }
}
