// Shared helpers for the optional access gate. Pure + uses the Web Crypto global
// (available in both the Edge middleware and the Node route), so the cookie value
// never contains the raw password.

export const GATE_COOKIE = 'cortex_gate'

export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`cortex-gate:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
