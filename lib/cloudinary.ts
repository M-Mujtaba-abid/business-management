import crypto from 'crypto'

// Server-side Cloudinary helpers (no SDK needed). Keys come from .env / hosting env vars.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
const apiKey = process.env.CLOUDINARY_API_KEY || ''
const apiSecret = process.env.CLOUDINARY_API_SECRET || ''

export const ORDER_PHOTO_FOLDER = 'business-manager/orders'
export const MAX_ORDER_PHOTOS = 5

export const cloudinaryConfigured = () => Boolean(cloudName && apiKey && apiSecret)

// Cloudinary signature: sha1 of the sorted "key=value&..." params followed by the API secret
const sign = (params: Record<string, string | number>) => {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
}

// Lets the browser upload one photo straight to Cloudinary (keeps big files off our server)
export function signUpload() {
  const timestamp = Math.floor(Date.now() / 1000)
  const params = { folder: ORDER_PHOTO_FOLDER, timestamp }
  return { cloudName, apiKey, timestamp, folder: ORDER_PHOTO_FOLDER, signature: sign(params) }
}

// Only photos uploaded by this app (our folder) may be deleted through it
export const isOurPhoto = (publicId: string) => publicId.startsWith(`${ORDER_PHOTO_FOLDER}/`)

// Deletes a photo from Cloudinary; failures are logged, not thrown (a leftover file must not block the app)
export async function destroyPhoto(publicId: string): Promise<boolean> {
  if (!cloudinaryConfigured() || !isOurPhoto(publicId)) return false
  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature: sign({ public_id: publicId, timestamp }),
    })
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body })
    const data = await res.json().catch(() => ({}))
    return data.result === 'ok' || data.result === 'not found'
  } catch (err) {
    console.error('Cloudinary destroy failed:', err)
    return false
  }
}

// Photo URLs we accept: https images from our own Cloudinary account
export const isOurPhotoUrl = (url: string) =>
  typeof url === 'string' && url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`)
