import { Gauge } from '@/components/charts/gauge'
import type { CrowdResult, Tick } from '@/sim/porterSim'

type Props = {
  tick: Tick | null
  result: CrowdResult | null
}

export function CrowdGauge({ tick, result }: Props) {
  if (!tick || !result) {
    return <p className="meta">Gauge waits for a run: grades running now, against the limit.</p>
  }

  const maxActive = result.maxActive
  const pct = maxActive === 0 ? 0 : (tick.slotsUsed / maxActive) * 100

  return (
    <div className="chart-wrap" data-testid="slot-gauge">
      <Gauge
        activeFill="var(--chart-vector)"
        centerValue={tick.slotsUsed}
        className="mx-auto h-[220px] max-w-[280px]"
        defaultLabel={`of ${maxActive} at once`}
        inactiveFill="var(--bg-raised)"
        value={pct}
      />
      <p className="meta">
        side lane {tick.overflowBusy} busy / {result.overflowActive} limit (used {result.overflowUsed} this run)
      </p>
    </div>
  )
}
