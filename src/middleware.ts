import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { gateToken, GATE_COOKIE } from '@/lib/gate'

const PUBLIC_PATHS = ['/login', '/api/auth']
const CRON_PATHS = [
  '/api/articles/fetch',
  '/api/articles/backfill-images',
  '/api/articles/enrich',
  '/api/alerts/check',
  '/api/internal',
]

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD
  const cronSecret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && (!password || !cronSecret)) {
    return NextResponse.json(
      { error: 'Configuração de segurança incompleta: APP_PASSWORD e CRON_SECRET são obrigatórios.' },
      { status: 503 }
    )
  }
  if (!password) return NextResponse.next()

  const { pathname } = req.nextUrl
  if (
    cronSecret &&
    CRON_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
    req.headers.get('authorization') === `Bearer ${cronSecret}`
  ) {
    return NextResponse.next()
  }
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
