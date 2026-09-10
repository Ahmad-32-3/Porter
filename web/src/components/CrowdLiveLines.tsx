import { LiveLineChart } from '@/components/charts/live-line-chart'
import { LiveLine } from '@/components/charts/live-line'
import { LiveXAxis } from '@/components/charts/live-x-axis'
import { LiveYAxis } from '@/components/charts/live-y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import type { LivePoint } from '@/hooks/useCrowdPlayback'

type Props = {
  grades: LivePoint[]
  tax: LivePoint[]
  paused: boolean
  reducedMotion: boolean
  split?: boolean
}

function intLabel(v: number) {
  return String(Math.round(v))
}

export function CrowdLiveLines({ grades, tax, paused, reducedMotion, split = false }: Props) {
  if (grades.length === 0) {
    return <p className="meta">Run the crowd to stream lookups reaching the server.</p>
  }

  const gradesNow = grades[grades.length - 1]?.value ?? 0
  const taxNow = tax[tax.length - 1]?.value ?? 0
  const pulse = !(paused || reducedMotion)

  return (
    <div className={split ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
      <div data-testid="live-line-grades" data-series="grades">
        <p className="meta">grades lookups reaching the server</p>
        <LiveLineChart
          data={grades}
          dataKey="grades"
          paused={paused}
          value={gradesNow}
          window={12}
        >
          <LiveLine
            badge
            dataKey="grades"
            formatValue={intLabel}
            pulse={pulse}
            stroke="var(--chart-vector)"
          />
          <LiveXAxis />
          <LiveYAxis formatValue={intLabel} />
          <ChartTooltip />
        </LiveLineChart>
      </div>
      <div data-testid="live-line-tax" data-series="tax">
        <p className="meta">tax fetches reaching the server</p>
        <LiveLineChart data={tax} dataKey="tax" paused={paused} value={taxNow} window={12}>
          <LiveLine
            badge
            dataKey="tax"
            formatValue={intLabel}
            pulse={pulse}
            stroke="var(--chart-grep)"
          />
          <LiveXAxis />
          <LiveYAxis formatValue={intLabel} />
          <ChartTooltip />
        </LiveLineChart>
      </div>
    </div>
  )
}
