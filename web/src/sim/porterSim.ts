export type Tick = {
  t: number
  grades: number
  tax: number
  waiting: number
  admitted: number
  slotsUsed: number
  overflowBusy: number
  overflowUsed: number
  served: number
  originGet: number
  crowd: number
}

export type Sample = Tick

export type CrowdResult = {
  series: Tick[]
  originGrades: number
  originTax: number
  originStatic: number
  waitingPeak: number
  overflowUsed: number
  served: number
  swappedGrades: boolean
  maxActive: number
  overflowActive: number
  gradeRequests: number
  peakWaitTick: number
  peakSlotsTick: number
}

type Job = {
  id: number
  path: 'grades' | 'tax' | 'static'
  student: string
  remaining: number
  lane: 'main' | 'overflow' | 'pass' | 'collapse'
}

export type CrowdOpts = {
  gradeRequests?: number
  taxRequests?: number
  staticRequests?: number
  maxActive?: number
  overflowActive?: number
  gradeWork?: number
  taxWork?: number
}

function fill<T>(n: number, fn: (i: number) => T): T[] {
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(fn(i))
  return out
}

export function runCrowd(opts: CrowdOpts = {}): CrowdResult {
  const gradeRequests = opts.gradeRequests ?? 24
  const taxRequests = opts.taxRequests ?? 16
  const staticRequests = opts.staticRequests ?? 8
  const maxActive = opts.maxActive ?? 2
  const overflowActive = opts.overflowActive ?? 1
  const gradeWork = opts.gradeWork ?? 4
  const taxWork = opts.taxWork ?? 1

  const pendingGrades = fill(gradeRequests, (i) => i)
  const pendingTax = fill(taxRequests, (i) => i)
  const pendingStatic = fill(staticRequests, (i) => i)

  let originGrades = 0
  let originTax = 0
  let originStatic = 0
  let waitingPeak = 0
  let overflowUsed = 0
  let served = 0
  let nextId = 1
  let staticFilled = false
  let peakWaitTick = 0
  let peakSlotsTick = 0
  let peakSlots = 0
  const bodies = new Map<number, string>()
  let swappedGrades = false

  const active: Job[] = []
  const series: Tick[] = []

  const ticks = gradeRequests * gradeWork + taxRequests + 8
  for (let t = 0; t < ticks; t++) {
    while (pendingTax.length) {
      const student = `tax-${pendingTax.shift()}`
      active.push({
        id: nextId++,
        path: 'tax',
        student,
        remaining: taxWork,
        lane: 'pass',
      })
      originTax += 1
    }

    if (pendingStatic.length) {
      const n = pendingStatic.length
      pendingStatic.length = 0
      if (!staticFilled) {
        originStatic += 1
        staticFilled = true
      }
      served += n
    }

    while (pendingGrades.length) {
      const mainBusy = active.filter((j) => j.path === 'grades' && j.lane === 'main').length
      if (mainBusy >= maxActive) break
      const sid = `student-${pendingGrades.shift()}`
      const id = nextId++
      bodies.set(id, sid)
      active.push({
        id,
        path: 'grades',
        student: sid,
        remaining: gradeWork,
        lane: 'main',
      })
      originGrades += 1
    }

    while (pendingGrades.length) {
      const ovBusy = active.filter((j) => j.path === 'grades' && j.lane === 'overflow').length
      if (ovBusy >= overflowActive) break
      const sid = `student-${pendingGrades.shift()}`
      const id = nextId++
      bodies.set(id, sid)
      active.push({
        id,
        path: 'grades',
        student: sid,
        remaining: gradeWork,
        lane: 'overflow',
      })
      originGrades += 1
      overflowUsed += 1
    }

    const waiting = pendingGrades.length
    if (waiting > waitingPeak) {
      waitingPeak = waiting
      peakWaitTick = t
    }

    const slotsUsed = active.filter((j) => j.path === 'grades' && j.lane === 'main').length
    const overflowBusy = active.filter((j) => j.path === 'grades' && j.lane === 'overflow').length
    const admitted = slotsUsed + overflowBusy
    if (slotsUsed > peakSlots) {
      peakSlots = slotsUsed
      peakSlotsTick = t
    }

    series.push({
      t,
      grades: originGrades,
      tax: originTax,
      waiting,
      admitted,
      slotsUsed,
      overflowBusy,
      overflowUsed,
      served,
      originGet: originGrades,
      crowd: gradeRequests,
    })

    const still: Job[] = []
    for (const job of active) {
      job.remaining -= 1
      if (job.remaining > 0) {
        still.push(job)
        continue
      }
      served += 1
      if (job.path === 'grades') {
        const expected = bodies.get(job.id)
        if (expected !== job.student) swappedGrades = true
      }
    }
    active.length = 0
    active.push(...still)
  }

  return {
    series,
    originGrades,
    originTax,
    originStatic,
    waitingPeak,
    overflowUsed,
    served,
    swappedGrades,
    maxActive,
    overflowActive,
    gradeRequests,
    peakWaitTick,
    peakSlotsTick,
  }
}

export function runCacheAllLeak(n = 4): { leaked: boolean; originHits: number } {
  const shared = 'grades for student-0'
  const got: string[] = []
  for (let i = 0; i < n; i++) {
    got.push(shared)
  }
  const leaked = got.some((body, i) => body !== `grades for student-${i}`)
  return { leaked, originHits: 1 }
}
