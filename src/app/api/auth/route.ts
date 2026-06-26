import { NextResponse } from 'next/server'
import { gateToken, GATE_COOKIE } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.json({ ok: true }) // gate disabled

  const body = await req.json().catch(() => null)
  if (!body?.password || body.password !== password) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATE_COOKIE, await gateToken(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
