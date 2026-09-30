'use client'

import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Animates a number from its previous value to `value` (ease-out), one rAF loop per change
export function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0)
  const fromRef = useRef(display)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const from = fromRef.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (value - from) * eased
      setDisplay(current)
      fromRef.current = current
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return display
}

// Width of an element, kept in sync with a ResizeObserver (charts draw at real pixel size so text stays crisp)
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export const formatPKR = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

// Short money label for axes: 1.2k, 3.4M
export const formatShort = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${Math.round(n)}`
}
