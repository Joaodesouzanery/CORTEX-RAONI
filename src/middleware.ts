import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { gateToken, GATE_COOKIE } from '@/lib/gate'

// Opt-in access gate: only active when APP_PASSWORD is set. Protects the whole
// app (incl. the paid /api/reports) behind a single shared password. Without
// APP_PASSWORD the app stays open (current behavior).
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/articles/fetch', '/api/alerts/check']

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.next() // gate disabled

  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(GATE_COOKIE)?.value
  if (cookie && cookie === (await gateToken(password))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('from', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
