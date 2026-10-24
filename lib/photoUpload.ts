// Browser-side order photo helpers: shrink on the device, upload straight to Cloudinary.

export interface OrderPhoto {
  id?: string // saved on the order
  url: string
  publicId: string
  width?: number | null
  height?: number | null
}

const MAX_SIDE = 1600
const QUALITY = 0.8

// Resize + re-encode as JPEG so a 4 MB phone photo becomes a few hundred KB (fast on mobile data)
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    // keep the original if it was already smaller
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file // e.g. HEIC the browser cannot decode: let Cloudinary handle it
  }
}

// Uploads one photo and returns its Cloudinary details (not yet saved on an order)
export async function uploadOrderPhoto(file: File): Promise<OrderPhoto> {
  const signRes = await fetch('/api/uploads/sign', { method: 'POST' })
  const sig = await signRes.json()
  if (!signRes.ok) throw new Error(sig.error || 'Photo upload is not available')

  const body = new FormData()
  body.append('file', await compress(file))
  body.append('api_key', sig.apiKey)
  body.append('timestamp', String(sig.timestamp))
  body.append('signature', sig.signature)
  body.append('folder', sig.folder)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Photo upload failed')
  return { url: data.secure_url, publicId: data.public_id, width: data.width, height: data.height }
}

// Deletes a photo that was uploaded but never saved on an order
export function discardOrderPhoto(publicId: string) {
  return fetch('/api/uploads/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  }).catch(() => undefined)
}

// Small, auto-format thumbnail of a Cloudinary photo (e.g. for grids)
export const photoThumb = (url: string, size = 240) =>
  url.replace('/image/upload/', `/image/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`)

// Screen-sized version for the viewer
export const photoLarge = (url: string) => url.replace('/image/upload/', '/image/upload/c_limit,w_1600,q_auto,f_auto/')
