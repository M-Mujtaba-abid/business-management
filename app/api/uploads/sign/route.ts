import { NextResponse } from 'next/server'
import { cloudinaryConfigured, signUpload } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

// One-time permission for the browser to upload a photo straight to Cloudinary
export async function POST() {
  if (!cloudinaryConfigured()) {
    return NextResponse.json({ error: 'Photo uploads are not set up (Cloudinary keys missing).' }, { status: 500 })
  }
  return NextResponse.json(signUpload())
}
