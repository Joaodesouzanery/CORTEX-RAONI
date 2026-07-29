import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CRON_PATHS = [
  '/api/articles/fetch',
  '/api/articles/backfill-images',
  '/api/articles/enrich',
  '/api/alerts/check',
  '/api/internal',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtectedWorkerPath = CRON_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  if (!isProtectedWorkerPath) return NextResponse.next()

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado para o worker.' }, { status: 503 })
  }

  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
