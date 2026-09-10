import type { CrowdResult } from './porterSim'
import type { LivePoint } from '../hooks/useCrowdPlayback'

const STEP = 0.04

export function seriesToLive(result: CrowdResult, key: 'grades' | 'tax', t0 = 0): LivePoint[] {
  return result.series.map((s) => ({ time: t0 + s.t * STEP, value: s[key] }))
}
