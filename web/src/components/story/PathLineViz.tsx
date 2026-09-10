import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Queue } from '@phosphor-icons/react/dist/csr/Queue'
import { motion, useReducedMotion } from 'motion/react'
import { springs } from '../../motion/tokens'
import { CrowdLiveLines } from '../CrowdLiveLines'
import { runCrowd } from '../../sim/porterSim'
import { seriesToLive } from '../../sim/seriesToLive'
import { useMemo } from 'react'

export function PathLineViz() {
  const reduce = Boolean(useReducedMotion())
  const snap = useMemo(
    () =>
      runCrowd({
        gradeRequests: 36,
        taxRequests: 18,
        staticRequests: 0,
        maxActive: 20,
        overflowActive: 0,
        gradeWork: 3,
        taxWork: 1,
      }),
    [],
  )

  const grades = useMemo(() => seriesToLive(snap, 'grades'), [snap])
  const tax = useMemo(() => seriesToLive(snap, 'tax'), [snap])

  return (
    <div className="teach-card" data-testid="path-line-viz">
      <h3 className="teach-card__title">A line on grades. An open gate for tax forms.</h3>
      <p className="meta">
        The rule is per page. <code>/grades</code> waits its turn. <code>/tax</code> (tax forms) never joins that line.
      </p>

      <div className="checkpoint" role="img" aria-label="Grades wait in a line. Tax forms pass through.">
        <div className="checkpoint__row">
          <span className="checkpoint__label">grades</span>
          <Queue aria-hidden className="checkpoint__icon" size={28} weight="duotone" />
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="flow__dot flow__dot--grades"
              initial={reduce ? false : { opacity: 0, x: -10 }}
              key={i}
              transition={reduce ? { duration: 0 } : { ...springs.gentle, delay: 0.08 * i }}
            />
          ))}
          <span className="checkpoint__note">waiting room</span>
        </div>
        <div className="checkpoint__row">
          <span className="checkpoint__label">tax forms</span>
          <CheckCircle aria-hidden className="checkpoint__icon checkpoint__icon--ok" size={28} weight="duotone" />
          {Array.from({ length: 2 }).map((_, i) => (
            <motion.span
              animate={{ opacity: 1 }}
              className="flow__dot flow__dot--tax"
              initial={reduce ? false : { opacity: 0 }}
              key={i}
              transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.15 * i }}
            />
          ))}
          <span className="checkpoint__note">pass, no ticket</span>
        </div>
      </div>

      <div className="chart-wrap chart-wrap--flush">
        <CrowdLiveLines grades={grades} paused tax={tax} reducedMotion />
      </div>
      <dl className="stat-grid stat-grid--inline">
        <div>
          <dt>Grades lookups at server</dt>
          <dd>{snap.originGrades}</dd>
        </div>
        <div>
          <dt>Tax fetches</dt>
          <dd className="stat-ok">{snap.originTax}</dd>
        </div>
        <div>
          <dt>Longest line</dt>
          <dd>{snap.waitingPeak}</dd>
        </div>
      </dl>
    </div>
  )
}
