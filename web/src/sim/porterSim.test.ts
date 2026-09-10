import { describe, expect, it } from 'vitest'
import { runCacheAllLeak, runCrowd } from './porterSim'

describe('runCrowd', () => {
  it('caps grades origin below the raw request count and leaves tax uncapped', () => {
    const r = runCrowd({
      gradeRequests: 12,
      taxRequests: 10,
      staticRequests: 6,
      maxActive: 2,
      overflowActive: 1,
    })
    expect(r.originTax).toBe(10)
    expect(r.originStatic).toBe(1)
    expect(r.originGrades).toBeLessThanOrEqual(12)
    expect(r.originGrades).toBeGreaterThan(0)
    expect(r.swappedGrades).toBe(false)
    expect(r.waitingPeak).toBeGreaterThan(0)
    expect(r.series.some((s) => s.waiting > 0 && s.slotsUsed <= 2)).toBe(true)
    expect(r.series[r.peakWaitTick]?.waiting).toBe(r.waitingPeak)
    expect(r.series.every((s) => s.slotsUsed <= r.maxActive)).toBe(true)
  })

  it('does not reuse one private grades body across students in the cache-all mistake', () => {
    const leak = runCacheAllLeak(5)
    expect(leak.leaked).toBe(true)
    expect(leak.originHits).toBe(1)
  })
})
