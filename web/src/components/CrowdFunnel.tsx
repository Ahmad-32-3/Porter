import { FunnelChart } from '@/components/charts/funnel-chart'
import type { Tick } from '@/sim/porterSim'

type Props = {
  tick: Tick | null
}

export function CrowdFunnel({ tick }: Props) {
  if (!tick) {
    return <p className="meta">Funnel waits for a run: crowd, waiting room, let in, server.</p>
  }

  return (
    <div className="chart-wrap" data-testid="crowd-funnel">
      <p className="meta">Cap, not a stampede. Most of the crowd sits in the room.</p>
      <FunnelChart
        color="var(--chart-vector)"
        data={[
          { label: 'crowd', value: Math.max(tick.crowd, 1), color: 'var(--fg-low)' },
          { label: 'waiting room', value: Math.max(tick.waiting, 0), color: 'var(--chart-vector)' },
          { label: 'let in', value: Math.max(tick.admitted, 0), color: 'var(--chart-grep)' },
          { label: 'server', value: Math.max(tick.originGet, 0), color: 'var(--accent)' },
        ]}
        formatValue={(v) => String(Math.round(v))}
        labelLayout="grouped"
        labelOrientation="vertical"
        showPercentage={false}
        staggerDelay={0.08}
      />
    </div>
  )
}
