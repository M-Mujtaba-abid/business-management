'use client'

import React from 'react'

// Search: the matching part of a text in green, so it is clear what matched
export default function Hl({ text, q }: { text: string | number | null | undefined; q: string }) {
  const str = text == null ? '' : String(text)
  const needle = q.trim().replace(/^#/, '')
  if (!needle || !str) return <>{str}</>
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = str.split(new RegExp(`(${esc})`, 'ig'))
  if (parts.length === 1) return <>{str}</>
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={i} className="rounded bg-emerald-100 px-0.5 font-bold text-emerald-700">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
}
