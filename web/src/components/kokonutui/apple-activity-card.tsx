'use client'

/**
 * @author: @kokonutui
 * @description: Apple Activity Card
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Porter maps rings to served / waiting / origin instead of Move / Exercise / Stand.
 */

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export type ActivityRing = {
  label: string
  current: number
  target: number
  color: string
  endColor?: string
}

type ActivityData = ActivityRing & {
  value: number
  size: number
  unit: string
}

type CircleProgressProps = {
  data: ActivityData
  index: number
  reducedMotion: boolean
}

const SIZES = [200, 160, 120]

function toActivities(rings: ActivityRing[]): ActivityData[] {
  return rings.slice(0, 3).map((ring, i) => {
    const target = Math.max(ring.target, 1)
    const pct = Math.min(100, (ring.current / target) * 100)
    return {
      ...ring,
      value: pct,
      size: SIZES[i] ?? 120,
      unit: '',
    }
  })
}

const CircleProgress = ({ data, index, reducedMotion }: CircleProgressProps) => {
  const strokeWidth = 16
  const radius = (data.size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = ((100 - data.value) / 100) * circumference
  const gradientId = `porter-ring-${index}`
  const gradientUrl = `url(#${gradientId})`
  const endColor = data.endColor ?? data.color
  const enter = reducedMotion
    ? { duration: 0 }
    : { duration: 1.8, delay: index * 0.2, ease: 'easeInOut' as const }

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex items-center justify-center"
      initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.8, delay: index * 0.2, ease: 'easeOut' }}
    >
      <div className="relative">
        <svg
          aria-label={`${data.label} ${data.current}`}
          className="-rotate-90 transform"
          height={data.size}
          viewBox={`0 0 ${data.size} ${data.size}`}
          width={data.size}
        >
          <title>{`${data.label} ${data.current}`}</title>
          <defs>
            <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor={data.color} stopOpacity={1} />
              <stop offset="100%" stopColor={endColor} stopOpacity={1} />
            </linearGradient>
          </defs>
          <circle
            className="text-zinc-800/80"
            cx={data.size / 2}
            cy={data.size / 2}
            fill="none"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            animate={{ strokeDashoffset: progress }}
            cx={data.size / 2}
            cy={data.size / 2}
            fill="none"
            initial={{ strokeDashoffset: reducedMotion ? progress : circumference }}
            r={radius}
            stroke={gradientUrl}
            strokeDasharray={circumference}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            transition={enter}
          />
        </svg>
      </div>
    </motion.div>
  )
}

function DetailedActivityInfo({
  activities,
  reducedMotion,
}: {
  activities: ActivityData[]
  reducedMotion: boolean
}) {
  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="ml-8 flex flex-col gap-6"
      initial={reducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.3 }}
    >
      {activities.map((activity) => (
        <div className="flex flex-col" key={activity.label}>
          <span className="font-medium text-[var(--fg-low)] text-sm">{activity.label}</span>
          <span className="font-semibold text-2xl" style={{ color: activity.color }}>
            {activity.current}
            <span className="ml-1 text-[var(--fg-low)] text-base">/{activity.target}</span>
          </span>
        </div>
      ))}
    </motion.div>
  )
}

export default function AppleActivityCard({
  title = 'Run totals',
  className,
  rings,
  reducedMotion = false,
}: {
  title?: string
  className?: string
  rings: ActivityRing[]
  reducedMotion?: boolean
}) {
  const activities = toActivities(rings)
  if (activities.length === 0) return null

  return (
    <div
      className={cn('relative mx-auto w-full max-w-3xl rounded-3xl p-4 text-[var(--fg-hi)]', className)}
      data-testid="count-rings"
    >
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
        <motion.h3
          animate={{ opacity: 1, y: 0 }}
          className="font-medium text-xl text-[var(--fg-hi)]"
          initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.5 }}
        >
          {title}
        </motion.h3>
        <div className="flex items-center">
          <div className="relative h-[180px] w-[180px]">
            {activities.map((activity, index) => (
              <CircleProgress
                data={activity}
                index={index}
                key={activity.label}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
          <DetailedActivityInfo activities={activities} reducedMotion={reducedMotion} />
        </div>
      </div>
    </div>
  )
}
