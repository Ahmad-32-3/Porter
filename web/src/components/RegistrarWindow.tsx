import { Buildings } from '@phosphor-icons/react/dist/csr/Buildings'
import { Exam } from '@phosphor-icons/react/dist/csr/Exam'
import { Monitor } from '@phosphor-icons/react/dist/csr/Monitor'
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt'
import { motion, useReducedMotion } from 'motion/react'

export type Stage = 0 | 1 | 2 | 3 | 4

type Props = {
  stage: Stage
  replayKey: number
  play?: boolean
}

const amber = '#e2703a'
const teal = '#22a58f'
const accent = '#35c9b4'
const ink = '#8a9499'
const inkDim = '#5c666b'
const hi = '#f4f6f7'

type StageConfig = {
  /** 0 = idle, 1 = maxed out. Drives the load meter under the computer. */
  load: number
  loadColor: string
  loadWord: string
  /** grade-day crowd overwhelms the shared computer, so tax is stuck too. */
  taxStuck: boolean
}

const CONFIG: Record<Stage, StageConfig> = {
  0: { load: 1, loadColor: amber, loadWord: 'maxed out', taxStuck: true },
  1: { load: 0.12, loadColor: teal, loadWord: 'idle (skipped)', taxStuck: false },
  2: { load: 0.45, loadColor: teal, loadWord: 'steady', taxStuck: false },
  3: { load: 0.4, loadColor: teal, loadWord: 'steady', taxStuck: false },
  4: { load: 0.45, loadColor: teal, loadWord: 'steady', taxStuck: false },
}

/** A student dot that slides in from the left edge each time the scene plays. */
function Student({
  x,
  y,
  i,
  fill = amber,
  animate,
  dim = false,
}: {
  x: number
  y: number
  i: number
  fill?: string
  animate: boolean
  dim?: boolean
}) {
  return (
    <motion.circle
      r={7}
      fill={fill}
      stroke="#08090a"
      strokeWidth={1}
      opacity={dim ? 0.4 : 1}
      initial={animate ? { cx: x - 46, cy: y, opacity: 0 } : { cx: x, cy: y, opacity: dim ? 0.4 : 1 }}
      animate={{ cx: x, cy: y, opacity: dim ? 0.4 : 1 }}
      transition={animate ? { duration: 0.55, delay: 0.06 * i, ease: 'easeOut' } : { duration: 0 }}
    />
  )
}

function Label({ x, y, children, fill = ink, anchor = 'start', size = 11, weight = 400 }: {
  x: number
  y: number
  children: string
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  weight?: number
}) {
  return (
    <text x={x} y={y} fill={fill} fontFamily="Inter, sans-serif" fontSize={size} fontWeight={weight} textAnchor={anchor}>
      {children}
    </text>
  )
}

/** The left half of the glass: what happens at the grades window changes per stage. */
function GradesScene({ stage, animate }: { stage: Stage; animate: boolean }) {
  if (stage === 0) {
    // Grade day: a crowd piles at the grades window.
    const crowd = [
      [70, 150],
      [96, 142],
      [88, 168],
      [116, 152],
      [110, 176],
      [138, 146],
      [134, 170],
      [160, 160],
      [156, 138],
    ] as const
    return (
      <g>
        <Label x={44} y={128} fill={amber}>
          hundreds open grades at once
        </Label>
        {crowd.map(([x, y], i) => (
          <Student key={i} x={x} y={y} i={i} animate={animate} />
        ))}
      </g>
    )
  }

  if (stage === 1) {
    // Cache: one saved page handed to everyone. It is Anna's page.
    const rows = [
      { name: 'Anna', ok: true },
      { name: 'Ben', ok: false },
      { name: 'Cara', ok: false },
    ]
    return (
      <g>
        <rect x={44} y={112} width={112} height={30} rx={4} fill="#101315" stroke={ink} />
        <Label x={52} y={125} fill={ink} size={9}>
          saved page
        </Label>
        <Label x={52} y={137} fill={hi} size={11} weight={600}>
          Anna&apos;s grades
        </Label>
        {rows.map((r, i) => {
          const y = 162 + i * 18
          return (
            <motion.g
              key={r.name}
              initial={animate ? { opacity: 0, x: -20 } : { opacity: 1, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={animate ? { duration: 0.4, delay: 0.25 + 0.18 * i } : { duration: 0 }}
            >
              <circle cx={58} cy={y} r={6} fill={amber} stroke="#08090a" />
              <Label x={72} y={y + 4} fill={ink} size={10}>
                {`${r.name} opens it`}
              </Label>
              <Label x={300} y={y + 4} fill={r.ok ? teal : amber} anchor="end" size={10} weight={600}>
                {r.ok ? 'right person' : 'wrong person'}
              </Label>
            </motion.g>
          )
        })}
      </g>
    )
  }

  if (stage === 2) {
    // Collapse: shared file merges to one fetch, private grades cannot.
    const shared = [128, 138, 148, 158]
    return (
      <g>
        <Label x={44} y={122} fill={ink}>
          shared file (stylesheet)
        </Label>
        {shared.map((x, i) => (
          <Student key={i} x={x} y={136} i={i} fill={teal} animate={animate} />
        ))}
        <motion.g
          initial={animate ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={animate ? { duration: 0.3, delay: 0.5 } : { duration: 0 }}
        >
          <line x1={168} y1={136} x2={196} y2={136} stroke={teal} strokeWidth={2} />
          <Label x={200} y={140} fill={teal} size={10} weight={600}>
            one fetch
          </Label>
        </motion.g>

        <Label x={44} y={170} fill={amber}>
          private grades
        </Label>
        {[128, 148, 168].map((x, i) => (
          <Student key={i} x={x} y={184} i={i} animate={animate} />
        ))}
        <Label x={200} y={188} fill={amber} size={10} weight={600}>
          own fetch each
        </Label>
      </g>
    )
  }

  if (stage === 3) {
    // Line only on grades: a queue behind a small cap gate.
    const queue = [60, 80, 100, 120, 140]
    return (
      <g>
        <Label x={44} y={128} fill={amber}>
          a line, only here
        </Label>
        <line x1={54} y1={162} x2={158} y2={162} stroke={inkDim} strokeWidth={2} strokeLinecap="round" />
        {queue.map((x, i) => (
          <Student key={i} x={x} y={162} i={i} animate={animate} />
        ))}
        <rect x={166} y={146} width={40} height={32} rx={4} fill="rgba(53,201,180,0.12)" stroke={accent} />
        <Label x={186} y={166} fill={accent} anchor="middle" size={9}>
          a few
        </Label>
        <Label x={186} y={176} fill={accent} anchor="middle" size={9}>
          at a time
        </Label>
      </g>
    )
  }

  // stage 4: line plus a small overflow lane and a wait card.
  const queue = [60, 80, 100, 120]
  return (
    <g>
      <Label x={44} y={120} fill={amber}>
        wait page, with your place in line
      </Label>
      <rect x={44} y={128} width={92} height={44} rx={4} fill="#050607" stroke={ink} />
      <Label x={52} y={144} fill={ink} size={9}>
        grades line
      </Label>
      <Label x={52} y={158} fill={hi} size={12} weight={600}>
        position 14
      </Label>
      <Label x={52} y={168} fill={inkDim} size={8}>
        opens when ready
      </Label>

      {queue.map((x, i) => (
        <Student key={i} x={x + 96} y={150} i={i} animate={animate} />
      ))}
      <line x1={150} y1={182} x2={206} y2={182} stroke={amber} strokeWidth={1} strokeDasharray="4 3" />
      <Label x={150} y={196} fill={amber} size={9}>
        small &quot;try anyway&quot; lane
      </Label>
    </g>
  )
}

export function RegistrarWindow({ stage, replayKey, play = true }: Props) {
  const reduce = useReducedMotion()
  const animate = play && !reduce
  const cfg = CONFIG[stage]
  const meterW = 120 * cfg.load

  return (
    <motion.svg
      viewBox="0 0 620 340"
      role="img"
      aria-label={`Campus portal window, stage ${stage}. Left is the grades window. Right is tax forms. One computer behind the glass serves both.`}
      width="100%"
      height="auto"
      key={replayKey}
      className="registrar-svg"
    >
      {/* building frame */}
      <rect x={16} y={16} width={588} height={308} rx={14} fill="#050607" />
      <rect x={12} y={12} width={588} height={308} rx={14} fill="#101315" stroke={ink} strokeWidth={2} />

      {/* titlebar */}
      <rect x={12} y={12} width={588} height={36} rx={14} fill="#171b1e" />
      <rect x={12} y={34} width={588} height={14} fill="#171b1e" />
      <circle cx={34} cy={30} r={4} fill="#5a3a3a" />
      <circle cx={50} cy={30} r={4} fill="#4a4632" />
      <circle cx={66} cy={30} r={4} fill="#1d8d7f" />
      <Buildings aria-hidden color={ink} height={20} weight="duotone" width={20} x={90} y={20} />
      <Label x={118} y={35} fill={ink}>
        campus portal
      </Label>

      {/* window headers */}
      <Exam aria-label="grades" color={amber} height={22} role="img" weight="duotone" width={22} x={44} y={62} />
      <Label x={72} y={78} fill={amber} weight={600} size={13}>
        grades window
      </Label>

      <Receipt aria-label="tax forms" color={teal} height={22} role="img" weight="duotone" width={22} x={528} y={62} />
      <Label x={520} y={78} fill={teal} anchor="end" weight={600} size={13}>
        tax forms
      </Label>

      {/* divider between the two service windows */}
      <line x1={310} y1={90} x2={310} y2={196} stroke={ink} strokeDasharray="3 4" strokeWidth={1} opacity={0.5} />

      {/* pipes: both windows draw on the same computer */}
      <line x1={150} y1={198} x2={296} y2={224} stroke={inkDim} strokeWidth={1} opacity={0.5} />
      <line x1={470} y1={198} x2={324} y2={224} stroke={inkDim} strokeWidth={1} opacity={0.5} />

      {/* left half: the grades scene changes per stage */}
      <GradesScene stage={stage} animate={animate} />

      {/* right half: tax forms window */}
      <Student x={470} y={150} i={0} fill={teal} animate={animate} dim={cfg.taxStuck} />
      {cfg.taxStuck ? (
        <Label x={470} y={176} fill={amber} anchor="middle" size={10}>
          stuck: server is busy
        </Label>
      ) : (
        <g>
          <line x1={480} y1={150} x2={520} y2={150} stroke={teal} strokeWidth={2} />
          <Label x={470} y={176} fill={teal} anchor="middle" size={10}>
            walks straight through
          </Label>
        </g>
      )}

      {/* shared computer + load meter */}
      <Monitor
        aria-label="computer"
        color={cfg.taxStuck ? amber : accent}
        height={56}
        role="img"
        weight="duotone"
        width={56}
        x={282}
        y={214}
      />
      <Label x={310} y={288} fill={ink} anchor="middle" size={10}>
        one computer serves both
      </Label>

      <rect x={250} y={296} width={120} height={12} rx={3} fill="#050607" stroke={inkDim} strokeWidth={1} />
      <motion.rect
        x={250}
        y={296}
        height={12}
        rx={3}
        fill={cfg.loadColor}
        initial={animate ? { width: 0 } : { width: meterW }}
        animate={{ width: meterW }}
        transition={animate ? { duration: 0.9, delay: 0.3, ease: 'easeOut' } : { duration: 0 }}
      />
      <Label x={378} y={306} fill={cfg.loadColor} size={10} weight={600}>
        {cfg.loadWord}
      </Label>
    </motion.svg>
  )
}
