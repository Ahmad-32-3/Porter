import { useEffect, useReducer, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const TICK_MS = 120
const GRADE_ARRIVAL_EVERY = 3
const TAX_ARRIVAL_EVERY = 20
const GRADE_WORK_TICKS = 7
const TAX_WORK_TICKS = 2
const GRADE_TRAVEL_TICKS = 2
const GRADE_TOTAL = 16
const TAX_TOTAL = 3

type Slot = 'travel' | 'queue' | 'origin' | 'tax-wait'
type Dot = { id: number; lane: 'grades' | 'tax'; slot: Slot; born: number }

type Sim = {
  tick: number
  playing: boolean
  done: boolean
  spawnedGrades: number
  spawnedTax: number
  origin: 'idle' | 'grades' | 'tax'
  originLeft: number
  dbQueries: number
  taxDone: number
  dots: Dot[]
  nextId: number
  flashDb: number
}

type Action = { type: 'reset' } | { type: 'tick' } | { type: 'freeze' }

function init(reduce: boolean): Sim {
  if (reduce) {
    return {
      tick: 0,
      playing: false,
      done: true,
      spawnedGrades: GRADE_TOTAL,
      spawnedTax: TAX_TOTAL,
      origin: 'grades',
      originLeft: 0,
      dbQueries: GRADE_TOTAL,
      taxDone: TAX_TOTAL,
      dots: [],
      nextId: 0,
      flashDb: GRADE_TOTAL,
    }
  }
  return {
    tick: 0,
    playing: false,
    done: false,
    spawnedGrades: 0,
    spawnedTax: 0,
    origin: 'idle',
    originLeft: 0,
    dbQueries: 0,
    taxDone: 0,
    dots: [],
    nextId: 0,
    flashDb: 0,
  }
}

function queueCount(dots: Dot[]) {
  return dots.filter((d) => d.lane === 'grades' && d.slot === 'queue').length
}

function reducer(state: Sim, action: Action): Sim {
  if (action.type === 'reset') return { ...init(false), playing: true }
  if (action.type === 'freeze') return { ...init(true), playing: false, done: true }
  if (!state.playing || state.done) return state

  let s: Sim = { ...state, tick: state.tick + 1 }

  if (s.tick % GRADE_ARRIVAL_EVERY === 0 && s.spawnedGrades < GRADE_TOTAL) {
    const dot: Dot = { id: s.nextId, lane: 'grades', slot: 'travel', born: s.tick }
    s = {
      ...s,
      spawnedGrades: s.spawnedGrades + 1,
      nextId: s.nextId + 1,
      dots: [...s.dots, dot].slice(-16),
    }
  }

  if (s.tick % TAX_ARRIVAL_EVERY === 0 && s.spawnedTax < TAX_TOTAL) {
    const dot: Dot = { id: s.nextId, lane: 'tax', slot: 'travel', born: s.tick }
    s = {
      ...s,
      spawnedTax: s.spawnedTax + 1,
      nextId: s.nextId + 1,
      dots: [...s.dots, dot].slice(-16),
    }
  }

  s = {
    ...s,
    dots: s.dots.map((d) => {
      if (d.slot !== 'travel') return d
      if (d.lane === 'grades' && s.tick - d.born >= GRADE_TRAVEL_TICKS) {
        return { ...d, slot: 'queue' as const }
      }
      if (d.lane === 'tax' && s.tick - d.born >= 1) {
        return { ...d, slot: 'tax-wait' as const }
      }
      return d
    }),
  }

  if (s.originLeft > 0) {
    s = { ...s, originLeft: s.originLeft - 1 }
    if (s.originLeft === 0) {
      if (s.origin === 'grades') {
        s = {
          ...s,
          origin: 'idle',
          dbQueries: s.dbQueries + 1,
          flashDb: s.dbQueries + 1,
          dots: s.dots.filter((d) => !(d.lane === 'grades' && d.slot === 'origin')),
        }
      } else {
        s = {
          ...s,
          origin: 'idle',
          taxDone: s.taxDone + 1,
          dots: s.dots.filter((d) => !(d.lane === 'tax' && d.slot === 'origin')),
        }
      }
    }
  }

  if (s.origin === 'idle') {
    const nextGrade = s.dots.find((d) => d.lane === 'grades' && d.slot === 'queue')
    if (nextGrade) {
      s = {
        ...s,
        origin: 'grades',
        originLeft: GRADE_WORK_TICKS,
        dots: s.dots.map((d) => (d.id === nextGrade.id ? { ...d, slot: 'origin' as const } : d)),
      }
    } else {
      const nextTax = s.dots.find((d) => d.lane === 'tax' && d.slot === 'tax-wait')
      if (nextTax) {
        s = {
          ...s,
          origin: 'tax',
          originLeft: TAX_WORK_TICKS,
          dots: s.dots.map((d) => (d.id === nextTax.id ? { ...d, slot: 'origin' as const } : d)),
        }
      }
    }
  }

  const queue = queueCount(s.dots)
  const arrivalsDone = s.spawnedGrades >= GRADE_TOTAL && s.spawnedTax >= TAX_TOTAL
  if (
    arrivalsDone &&
    s.origin === 'idle' &&
    queue === 0 &&
    s.dbQueries >= GRADE_TOTAL &&
    s.taxDone >= TAX_TOTAL
  ) {
    s = { ...s, playing: false, done: true, dots: [] }
  }

  return s
}

export function BottleneckViz() {
  const reduce = Boolean(useReducedMotion())
  const root = useRef<HTMLDivElement>(null)
  const [sim, dispatch] = useReducer(reducer, reduce, init)

  useEffect(() => {
    if (reduce) {
      dispatch({ type: 'freeze' })
      return
    }
    const node = root.current
    if (!node) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting && e.intersectionRatio >= 0.35)
        if (hit) dispatch({ type: 'reset' })
      },
      { threshold: [0.35, 0.55] },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [reduce])

  useEffect(() => {
    if (!sim.playing || reduce) return
    const id = window.setInterval(() => dispatch({ type: 'tick' }), TICK_MS)
    return () => window.clearInterval(id)
  }, [sim.playing, reduce])

  const gradeTravel = sim.dots.filter((d) => d.lane === 'grades' && d.slot === 'travel')
  const gradeQueue = sim.dots.filter((d) => d.lane === 'grades' && d.slot === 'queue')
  const gradeOrigin = sim.dots.find((d) => d.lane === 'grades' && d.slot === 'origin')
  const taxTravel = sim.dots.filter((d) => d.lane === 'tax' && d.slot === 'travel')
  const taxWait = sim.dots.filter((d) => d.lane === 'tax' && d.slot === 'tax-wait')
  const taxOrigin = sim.dots.find((d) => d.lane === 'tax' && d.slot === 'origin')
  const queue = queueCount(sim.dots)

  return (
    <div className="teach-card bottleneck" data-testid="bottleneck-viz" ref={root}>
      <div className="bottleneck__head">
        <h3 className="teach-card__title">Watch the bottleneck</h3>
        {!reduce ? (
          <button className="bottleneck__replay" onClick={() => dispatch({ type: 'reset' })} type="button">
            Replay
          </button>
        ) : null}
      </div>
      <p className="meta">
        Orange is students opening grades. Teal is one person opening a tax form on the same server.
      </p>

      <div
        aria-label="Students queue at the origin while each grades request runs a database query"
        className="bottleneck__stage"
        role="img"
      >
        <div className="bottleneck__cols" aria-hidden>
          <span>students</span>
          <span>queue</span>
          <span className="bottleneck__col-origin">origin</span>
          <span>database</span>
        </div>

        <div className="bottleneck__gate" aria-hidden />

        <div className="bottleneck__lane">
          <p className="bottleneck__lane-name">GET /grades</p>
          <div className="bottleneck__track">
            {gradeTravel.map((d) => (
              <motion.span
                animate={{ left: '22%' }}
                className="bottleneck__dot bottleneck__dot--grades"
                initial={{ left: '4%' }}
                key={d.id}
                transition={{ duration: GRADE_TRAVEL_TICKS * (TICK_MS / 1000), ease: 'easeOut' }}
              />
            ))}
            {gradeQueue.map((d, i) => (
              <motion.span
                className="bottleneck__dot bottleneck__dot--grades"
                key={d.id}
                layout
                style={{ left: `${22 + i * 5}%` }}
                transition={{ duration: 0.2 }}
              />
            ))}
            {gradeOrigin ? (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                className="bottleneck__dot bottleneck__dot--grades bottleneck__dot--pulse"
                key={gradeOrigin.id}
                style={{ left: '56%' }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            ) : null}
            {sim.flashDb > 0 ? (
              <motion.span
                animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.8] }}
                className="bottleneck__db-flash"
                key={sim.flashDb}
                style={{ left: '84%' }}
                transition={{ duration: 0.45 }}
              />
            ) : null}
          </div>
        </div>

        <div className="bottleneck__lane bottleneck__lane--tax">
          <p className="bottleneck__lane-name">GET /tax (tax forms)</p>
          <div className="bottleneck__track">
            {taxTravel.map((d) => (
              <motion.span
                animate={{ left: '56%' }}
                className="bottleneck__dot bottleneck__dot--tax"
                initial={{ left: '4%' }}
                key={d.id}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            ))}
            {taxWait.map((d, i) => (
              <span
                className="bottleneck__dot bottleneck__dot--tax bottleneck__dot--dim"
                key={d.id}
                style={{ left: `${38 + i * 4}%` }}
              />
            ))}
            {taxOrigin ? (
              <span className="bottleneck__dot bottleneck__dot--tax" key={taxOrigin.id} style={{ left: '56%' }} />
            ) : null}
          </div>
        </div>

        <div className="bottleneck__origin-box">
          <p className="bottleneck__origin-title">origin server</p>
          <p className="bottleneck__origin-line bottleneck__origin-line--grades">
            {sim.origin === 'grades' ? 'running a grades query…' : 'one thing at a time'}
          </p>
          <p className="bottleneck__origin-line bottleneck__origin-line--tax">
            {sim.origin === 'tax' ? 'finally serving the tax form…' : 'tax form waits: computer busy with grades'}
          </p>
        </div>
      </div>

      <dl className="stat-grid stat-grid--inline">
        <div>
          <dt>Students on /grades</dt>
          <dd>{sim.spawnedGrades}</dd>
        </div>
        <div>
          <dt>In queue</dt>
          <dd className={queue > 4 ? 'stat-warn' : undefined}>{queue}</dd>
        </div>
        <div>
          <dt>DB queries</dt>
          <dd className="stat-warn">{sim.dbQueries}</dd>
        </div>
        <div>
          <dt>Tax forms done</dt>
          <dd className="stat-ok">{sim.taxDone}</dd>
        </div>
      </dl>

      <p className="meta teach-card__explain">
        {sim.done || reduce
          ? `${GRADE_TOTAL} students, ${GRADE_TOTAL} database queries. The server runs one at a time, so the queue grows faster than it drains. The tax form waits behind the whole pile, because there is one computer and grades never lets go. That is the point: on the same server, tax goes down with grades.`
          : 'Students arrive faster than the server finishes. Watch the queue grow while the tax form waits its turn behind every grades query.'}
      </p>
    </div>
  )
}
