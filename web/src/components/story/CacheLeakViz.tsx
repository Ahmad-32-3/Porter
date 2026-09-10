import { Prohibit } from '@phosphor-icons/react/dist/csr/Prohibit'
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle'
import { motion, useReducedMotion } from 'motion/react'
import { springs } from '../../motion/tokens'

const students = [
  { id: 'Anna', ok: true },
  { id: 'Ben', ok: false },
  { id: 'Cara', ok: false },
  { id: 'Dev', ok: false },
]

export function CacheLeakViz() {
  const reduce = Boolean(useReducedMotion())

  return (
    <div className="teach-card" data-testid="cache-leak-viz">
      <h3 className="teach-card__title">Everyone gets Anna&apos;s page</h3>
      <p className="meta">Save one grades page, skip the database, and hand that copy to whoever asks next.</p>

      <div className="checkpoint" role="img" aria-label="The database is never touched. Students all receive one saved grades page.">
        <div className="checkpoint__row">
          <span className="checkpoint__label">database</span>
          <Prohibit aria-hidden className="checkpoint__icon checkpoint__icon--stop" size={32} weight="duotone" />
          <span className="checkpoint__note">never touched</span>
        </div>
        <div className="checkpoint__row checkpoint__row--shelf">
          <span className="checkpoint__label">saved page</span>
          <code>grades for Anna</code>
        </div>
        <ul className="leak-list">
          {students.map((s, i) => (
            <motion.li
              className={s.ok ? 'leak-row leak-row--ok' : 'leak-row leak-row--bad'}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              key={s.id}
              transition={reduce ? { duration: 0 } : { ...springs.gentle, delay: 0.15 * i }}
            >
              <span className="leak-who">{s.id}</span>
              <code className="leak-body">grades for Anna</code>
              {s.ok ? (
                <span className="leak-tag leak-tag--ok">match</span>
              ) : (
                <span className="leak-tag">
                  <XCircle aria-hidden size={14} weight="fill" /> wrong student
                </span>
              )}
            </motion.li>
          ))}
        </ul>
      </div>
      <p className="meta teach-card__explain">
        Skipping the database is what makes this tempting: the overloaded computer never runs. It still fails, because
        grades are private. Ben cannot be handed Anna&apos;s numbers.
      </p>
    </div>
  )
}
