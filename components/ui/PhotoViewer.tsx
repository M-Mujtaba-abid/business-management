'use client'

import React, { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { photoLarge } from '@/lib/photoUpload'

interface PhotoViewerProps {
  urls: string[]
  index: number | null // which photo is open; null = closed
  onChange: (index: number | null) => void
}

// Full-screen photo view with previous / next (arrow keys and Esc work too)
export default function PhotoViewer({ urls, index, onChange }: PhotoViewerProps) {
  const open = index !== null && index >= 0 && index < urls.length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null)
      if (e.key === 'ArrowRight') onChange(((index as number) + 1) % urls.length)
      if (e.key === 'ArrowLeft') onChange(((index as number) - 1 + urls.length) % urls.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, urls.length, onChange])

  if (!open) return null
  const i = index as number

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 flex items-center justify-center p-4" onClick={() => onChange(null)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoLarge(urls[i])}
        alt={`Order photo ${i + 1}`}
        className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button onClick={() => onChange(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
        <X className="h-6 w-6" />
      </button>
      {urls.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChange((i - 1 + urls.length) % urls.length)
            }}
            className="absolute left-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChange((i + 1) % urls.length)
            }}
            className="absolute right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-4 text-white/80 text-sm">{i + 1} / {urls.length}</div>
        </>
      )}
    </div>
  )
}
