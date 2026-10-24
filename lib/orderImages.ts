import { isOurPhoto, isOurPhotoUrl, MAX_ORDER_PHOTOS } from './cloudinary'

export interface ImageInput {
  id?: string // already saved photo (edit)
  url: string
  publicId: string
  width?: number | null
  height?: number | null
}

// Validates photos sent with an order: our Cloudinary account / folder only, at most MAX_ORDER_PHOTOS
export function parseImages(raw: unknown): { images: ImageInput[] } | { error: string } {
  if (raw === undefined || raw === null) return { images: [] }
  if (!Array.isArray(raw)) return { error: 'Photos are not valid.' }
  if (raw.length > MAX_ORDER_PHOTOS) return { error: `An order can have at most ${MAX_ORDER_PHOTOS} photos.` }
  const images: ImageInput[] = []
  for (const r of raw) {
    const url = typeof r?.url === 'string' ? r.url : ''
    const publicId = typeof r?.publicId === 'string' ? r.publicId : ''
    if (!isOurPhotoUrl(url) || !isOurPhoto(publicId)) return { error: 'A photo could not be verified. Please upload it again.' }
    images.push({
      id: typeof r.id === 'string' ? r.id : undefined,
      url,
      publicId,
      width: Number.isFinite(r.width) ? Math.round(r.width) : null,
      height: Number.isFinite(r.height) ? Math.round(r.height) : null,
    })
  }
  return { images }
}
