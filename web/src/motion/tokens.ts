export const springs = {
  snappy: { stiffness: 420, damping: 32, mass: 0.8 },
  gentle: { stiffness: 180, damping: 24, mass: 1 },
} as const

export const motionTokens = {
  fast: 0.18,
  normal: 0.32,
  slow: 0.55,
} as const
