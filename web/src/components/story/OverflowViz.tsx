import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Queue } from '@phosphor-icons/react/dist/csr/Queue'
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { springs } from '../../motion/tokens'
import { CrowdFunnel } from '../CrowdFunnel'
import { CrowdGauge } from '../CrowdGauge'
import { runCrowd } from '../../sim/porterSim'
import { WaitingRoomPreview } from './WaitingRoomPreview'

export function OverflowViz() {
  const reduce = Boolean(useReducedMotion())
  const snap = useMemo(
    () =>
      runCrowd({
        gradeRequests: 32,
        taxRequests: 10,
        staticRequests: 0,
        maxActive: 8,
        overflowActive: 3,
        gradeWork: 4,
        taxWork: 1,
      }),
    [],
  )

  const peakWait = snap.series[snap.peakWaitTick] ?? snap.series[snap.series.length - 1]
  const peakSlots = snap.series[snap.peakSlotsTick] ?? snap.series[snap.series.length - 1]

  return (
    <div className="story-viz-stack" data-testid="overflow-viz">
      <div className="teach-card">
        <h3 className="teach-card__title">Wait page, plus a small side lane</h3>
        <p className="meta">This is what Porter ships. Your place in line is shown as text. Try anyway is not a free skip.</p>
        <div className="checkpoint" role="img" aria-label="Main grades line plus a smaller overflow lane. Tax forms still pass.">
          <div className="checkpoint__row">
            <span className="checkpoint__label">grades</span>
            <Queue aria-hidden className="checkpoint__icon" size={28} weight="duotone" />
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.span
                animate={{ opacity: 1 }}
                className="flow__dot flow__dot--grades"
                initial={reduce ? false : { opacity: 0 }}
                key={i}
                transition={reduce ? { duration: 0 } : { ...springs.gentle, delay: 0.08 * i }}
              />
            ))}
            <span className="checkpoint__note">main limit</span>
          </div>
          <div className="checkpoint__row">
            <span className="checkpoint__label">try anyway</span>
            <SignOut aria-hidden className="checkpoint__icon checkpoint__icon--overflow" size={28} weight="duotone" />
            {Array.from({ length: 2 }).map((_, i) => (
              <motion.span
                animate={{ opacity: 1 }}
                className="flow__dot flow__dot--overflow"
                initial={reduce ? false : { opacity: 0 }}
                key={i}
                transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.15 * i }}
              />
            ))}
            <span className="checkpoint__note">tighter limit</span>
          </div>
          <div className="checkpoint__row">
            <span className="checkpoint__label">tax forms</span>
            <CheckCircle aria-hidden className="checkpoint__icon checkpoint__icon--ok" size={28} weight="duotone" />
            <span className="checkpoint__note">still pass</span>
          </div>
        </div>
      </div>
      <WaitingRoomPreview />
      <div className="grid gap-4">
        <CrowdFunnel tick={peakWait ?? null} />
        <CrowdGauge result={snap} tick={peakSlots ?? null} />
      </div>
      <p className="meta">
        The side lane was used {snap.overflowUsed} times this run. Main limit {snap.maxActive} at once, side lane{' '}
        {snap.overflowActive}. If everyone takes the side lane, the stampede comes back.
      </p>
    </div>
  )
}
