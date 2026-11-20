import { NextRequest, NextResponse } from 'next/server'
import { leopardsCities, matchCity } from '@/lib/leopardsBooking'

export const dynamic = 'force-dynamic'

// GET ?city=Gujrat → { cities: [{ id, name }], match: { id, name } | null }
export async function GET(request: NextRequest) {
  try {
    const cities = await leopardsCities()
    if (!cities.length) return NextResponse.json({ error: 'Could not load the Leopards city list.' }, { status: 502 })
    return NextResponse.json({ cities, match: matchCity(cities, request.nextUrl.searchParams.get('city')) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load Leopards cities' }, { status: 500 })
  }
}
