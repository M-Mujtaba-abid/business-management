'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { OrderPhoto, uploadOrderPhoto, discardOrderPhoto, photoThumb } from '@/lib/photoUpload'
import PhotoViewer from './PhotoViewer'

interface PhotoPickerProps {
  photos: OrderPhoto[]
  onChange: (photos: OrderPhoto[]) => void
  max?: number
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void // true while a photo is uploading
}

// Order photos: thumbnails, "+ Add photo" (camera or gallery), remove. Uploads happen right away;
// the photos are attached to the order when the order is saved.
export default function PhotoPicker({ photos, onChange, max = 5, disabled, onBusyChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const room = max - photos.length - uploading

  useEffect(() => {
    onBusyChange?.(uploading > 0)
  }, [uploading, onBusyChange])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const picked = Array.from(files).slice(0, Math.max(0, room))
    if (files.length > picked.length) toast.error(`An order can have at most ${max} photos.`)
    setUploading((n) => n + picked.length)
    let current = photos
    for (const file of picked) {
      try {
        const photo = await uploadOrderPhoto(file)
        current = [...current, photo]
        onChange(current)
      } catch (err: any) {
        toast.error(err.message || 'Photo upload failed')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = (photo: OrderPhoto) => {
    onChange(photos.filter((p) => p !== photo))
    // a photo not yet saved on the order is deleted from storage straight away
    if (!photo.id) discardOrderPhoto(photo.publicId)
  }

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {photos.map((p, i) => (
          <div key={p.publicId} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoThumb(p.url)}
              alt={`Order photo ${i + 1}`}
              loading="lazy"
              onClick={() => setViewing(i)}
              className="h-full w-full object-cover cursor-zoom-in"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(p)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/70 text-white hover:bg-rose-600"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="aspect-square rounded-lg border border-dashed border-emerald-300 bg-emerald-50 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
          </div>
        ))}

        {!disabled && room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 flex flex-col items-center justify-center gap-0.5 transition"
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Add photo</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-1">
        Optional · up to {max} photos{photos.length ? ` · ${photos.length} added` : ''}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <PhotoViewer urls={photos.map((p) => p.url)} index={viewing} onChange={setViewing} />
    </div>
  )
}
