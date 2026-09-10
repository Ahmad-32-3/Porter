import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { RegistrarWindow, type Stage } from '../RegistrarWindow'

type Props = {
  id: string
  stage: Stage
  title: string
  kicker?: string
  children: ReactNode
  visual?: ReactNode
  stageCaption: string
}

export function StoryBeat({ id, stage, title, kicker, children, visual, stageCaption }: Props) {
  const reduce = Boolean(useReducedMotion())
  const ref = useRef<HTMLElement>(null)
  const [replayKey, setReplayKey] = useState(0)
  const [played, setPlayed] = useState(reduce)

  useEffect(() => {
    if (reduce) return
    const node = ref.current
    if (!node) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting && e.intersectionRatio >= 0.35)
        if (hit) setPlayed(true)
      },
      { threshold: [0.35, 0.55] },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [reduce])

  return (
    <section className="story-beat" data-stage-id={id} id={id} ref={ref}>
      <div className="story-beat__grid">
        <div className="story-beat__copy">
          {kicker ? <p className="story-kicker">{kicker}</p> : null}
          <h2>{title}</h2>
          <div className="story-prose">{children}</div>
        </div>
        <div className="story-beat__panel">
          <div className="story-window">
            <RegistrarWindow play={played} replayKey={replayKey} stage={stage} />
            <div className="story-window__bar">
              <p className="meta story-caption">{stageCaption}</p>
              <button
                type="button"
                onClick={() => {
                  setPlayed(true)
                  setReplayKey((k) => k + 1)
                }}
              >
                Replay
              </button>
            </div>
          </div>
          {visual ? (
            <div className="story-viz" key={replayKey}>
              {visual}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
