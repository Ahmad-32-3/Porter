'use client'

/**
 * @author: @dorianbaffier
 * @description: Particle Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { MousePointerClick } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, type RefObject, useRef, useState } from 'react'
import type { ButtonProps } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ParticleButtonProps extends ButtonProps {
  onSuccess?: () => void
  successDuration?: number
}

function SuccessParticles({ buttonRef }: { buttonRef: RefObject<HTMLButtonElement | null> }) {
  const rect = buttonRef.current?.getBoundingClientRect()
  if (!rect) return null

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  return (
    <AnimatePresence>
      {Array.from({ length: 6 }, (_, i) => (
        <motion.div
          animate={{
            scale: [0, 1, 0],
            x: [0, (i % 2 ? 1 : -1) * (Math.random() * 50 + 20)],
            y: [0, -Math.random() * 50 - 20],
          }}
          className="fixed h-1 w-1 rounded-full bg-[var(--accent)]"
          initial={{ scale: 0, x: 0, y: 0 }}
          key={i}
          style={{ left: centerX, top: centerY }}
          transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
        />
      ))}
    </AnimatePresence>
  )
}

export default function ParticleButton({
  children,
  onClick,
  onSuccess,
  successDuration = 1000,
  className,
  ...props
}: ParticleButtonProps) {
  const [showParticles, setShowParticles] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const reduced = Boolean(useReducedMotion())

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (!reduced) {
      setShowParticles(true)
      window.setTimeout(() => setShowParticles(false), successDuration)
    }
    onSuccess?.()
  }

  return (
    <>
      {showParticles ? <SuccessParticles buttonRef={buttonRef} /> : null}
      <Button
        className={cn('relative transition-transform duration-100', showParticles && 'scale-95', className)}
        onClick={handleClick}
        ref={buttonRef}
        {...props}
      >
        {children}
        <MousePointerClick className="h-4 w-4" />
      </Button>
    </>
  )
}
