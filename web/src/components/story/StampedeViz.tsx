import { useMemo } from 'react'
import { runCrowd } from '../../sim/porterSim'

/** Numbers beside the registrar window: shows 1:1 student-to-origin ratio with no Porter. */
export function StampedeViz() {
  const snap = useMemo(
    () =>
      runCrowd({
        gradeRequests: 24,
        taxRequests: 4,
        staticRequests: 0,
        maxActive: 999,
        overflowActive: 0,
        gradeWork: 3,
      }),
    [],
  )

  return (
    <div className="teach-card" data-testid="stampede-viz">
      <h3 className="teach-card__title">Without a line: 24 students, 24 trips to the server</h3>
      <div className="ratio-viz" aria-hidden>
        <div className="ratio-viz__col">
          <p className="ratio-viz__label">students waiting</p>
          <div className="ratio-viz__dots">
            {Array.from({ length: 12 }).map((_, i) => (
              <span className="ratio-viz__dot ratio-viz__dot--grades" key={i} />
            ))}
          </div>
          <p className="ratio-viz__num">{snap.gradeRequests}</p>
        </div>
        <div className="ratio-viz__arrow">→</div>
        <div className="ratio-viz__col">
          <p className="ratio-viz__label">trips to the server</p>
          <div className="ratio-viz__dots">
            {Array.from({ length: 12 }).map((_, i) => (
              <span className="ratio-viz__dot ratio-viz__dot--warn" key={i} />
            ))}
          </div>
          <p className="ratio-viz__num stat-warn">{snap.originGrades}</p>
        </div>
      </div>
      <p className="meta teach-card__explain">
        Porter is not in front yet, so every student who opens <code>/grades</code> makes the server do the full lookup
        again. That is the crowd in the window above: orange dots piled at the grades counter, one computer behind the
        glass running every query.
      </p>
    </div>
  )
}
