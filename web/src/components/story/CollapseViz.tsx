import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { Prohibit } from '@phosphor-icons/react/dist/csr/Prohibit'
import { motion, useReducedMotion } from 'motion/react'
import { springs } from '../../motion/tokens'

export function CollapseViz() {
  const reduce = Boolean(useReducedMotion())

  return (
    <div className="teach-card" data-testid="collapse-viz">
      <h3 className="teach-card__title">Share one fetch, only when the page is the same for all</h3>
      <p className="meta">Many people waiting on the exact same file can ride one fetch. Personal pages cannot.</p>

      <div className="checkpoint" role="img" aria-label="A shared stylesheet merges to one fetch. Private grades each need their own.">
        <div className="collapse-row">
          <p className="collapse-row__title">/static/style.css (shared file)</p>
          <div className="collapse-row__body">
            <div className="flow__dots" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.span
                  animate={{ x: reduce ? 0 : [0, 48] }}
                  className="flow__dot flow__dot--tax"
                  initial={false}
                  key={i}
                  transition={reduce ? { duration: 0 } : { ...springs.gentle, delay: 0.08 * i }}
                />
              ))}
            </div>
            <CheckCircle aria-hidden className="checkpoint__icon checkpoint__icon--ok" size={28} weight="duotone" />
            <p className="stat-ok collapse-row__result">one fetch for all</p>
          </div>
        </div>
        <div className="collapse-row">
          <p className="collapse-row__title">/grades (personal page)</p>
          <div className="collapse-row__body">
            <div className="flow__dots" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <span className="flow__dot flow__dot--grades" key={i} />
              ))}
            </div>
            <Prohibit aria-hidden className="checkpoint__icon checkpoint__icon--stop" size={28} weight="duotone" />
            <p className="stat-warn collapse-row__result">own fetch each</p>
          </div>
        </div>
      </div>
      <p className="meta teach-card__explain">
        Sharing one fetch works for files everyone can use, like the stylesheet. It cannot work for logged-in grades, so
        it does not replace a waiting room on <code>/grades</code>.
      </p>
    </div>
  )
}
