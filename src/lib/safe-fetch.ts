import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

/**
 * Guarda de request-forgery para toda saída HTTP a URL de terceiro.
 *
 * Extraída de src/app/api/import-batches/[id]/items/route.ts, onde era a única
 * do repositório. Os outros cinco caminhos de saída — feed RSS, og:image,
 * scrape de listagem, scrape de página e extração de íntegra — buscavam
 * `sources.url` e `articles.url` sem validação nenhuma. Como `POST /api/sources`
 * aceita qualquer URL, dava para registrar uma fonte apontando para a rede
 * interna, disparar a coleta e LER o resultado de volta: `scrapeOpenGraph`
 * grava `<title>` e `og:description` na linha do artigo, que sai por
 * `GET /api/articles`. É exfiltração, não SSRF cego.
 *
 * Limitação conhecida e aceita: DNS rebinding. `lookup()` resolve o nome e o
 * `fetch()` resolve de novo, de forma independente — um registro com TTL zero
 * que alterne entre um IP público e 127.0.0.1 passa. Não há como fixar o IP
 * resolvido usando o `fetch` da Web na Vercel. O risco residual é pequeno
 * porque funções da Vercel rodam em Lambda, que não expõe metadados em
 * 169.254.169.254.
 */

const REDIRECT_STATUS = [301, 302, 303, 307, 308]

/** Faixas IPv4 privadas, reservadas e de uso especial. */
function privateIPv4(parts: number[]): boolean {
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true // quad malformado: nega por precaução
  }
  const [a, b] = parts
  return (
    a === 0 || // "este" host
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT — usado por Fly.io, Tailscale, k8s
    (a === 169 && b === 254) || // link-local e metadados de nuvem
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 0) || // IETF protocol assignments / TEST-NET-1
    (a === 192 && b === 168) || // RFC1918
    (a === 198 && (b === 18 || b === 19)) || // benchmark
    (a === 198 && b === 51) || // TEST-NET-2
    (a === 203 && b === 0) || // TEST-NET-3
    a >= 224 // multicast e reservado, inclui 255.255.255.255
  )
}

/**
 * Expande um literal IPv6 para os 8 grupos numéricos.
 *
 * Trata `::` em qualquer posição e a cauda em quad decimal. É o que faz
 * `::ffff:a.b.c.d`, `::ffff:7f00:1` e `0:0:0:0:0:ffff:127.0.0.1` colapsarem nos
 * MESMOS 8 grupos — sem isso, cada forma comprimida precisaria de uma regra de
 * string própria, que foi exatamente como o bug anterior nasceu.
 *
 * Devolve `null` quando não consegue interpretar (o chamador nega).
 */
function hextets(address: string): number[] | null {
  let text = address.toLowerCase().split('%')[0] // descarta zone id (fe80::1%eth0)
  let tail: number[] = []

  // Cauda em quad decimal: troca por dois grupos zero para a aritmética do `::`
  // ficar uniforme, e reinjeta nos grupos 6 e 7 no fim.
  const quad = text.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (quad) {
    const octets = quad[1].split('.').map(Number)
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null
    tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]]
    text = text.slice(0, quad.index) + '0:0'
  }

  const halves = text.split('::')
  if (halves.length > 2) return null
  const parse = (chunk: string) =>
    chunk === '' ? [] : chunk.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN))

  const head = parse(halves[0])
  const rest = halves.length === 2 ? parse(halves[1]) : []
  if ([...head, ...rest].some((n) => Number.isNaN(n))) return null

  let groups: number[]
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length
    if (fill < 0) return null
    groups = [...head, ...Array(fill).fill(0), ...rest]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  if (tail.length) {
    groups[6] = tail[0]
    groups[7] = tail[1]
  }
  return groups
}

/**
 * Decide se um endereço resolvido é privado/reservado.
 *
 * Despacha por `isIP()`, NUNCA por formato de string. A versão anterior
 * terminava com `return normalized.includes(':')`, o que classificava QUALQUER
 * IPv6 público como privado — e como `assertPublicUrl` nega o host se algum
 * endereço resolvido for privado, bastava um registro AAAA para bloquear tudo.
 * news.google.com (transporte de ~45 das ~50 fontes) e www.gov.br têm AAAA:
 * a coleta inteira teria morrido no deploy.
 */
function privateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return privateIPv4(address.split('.').map(Number))
  if (family !== 6) return true // não é IP reconhecível: nega

  const g = hextets(address)
  if (!g) return true

  // ::ffff:a.b.c.d (mapeado) e ::ffff:0:a.b.c.d (traduzido) → julga como IPv4
  const mapped = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff
  const translated = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0xffff && g[5] === 0
  if (mapped || translated) {
    return privateIPv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff])
  }
  // ::, ::1 e IPv4-compatível (::a.b.c.d)
  if (g.slice(0, 6).every((h) => h === 0)) return true

  if (g[0] === 0x64 && g[1] === 0xff9b) return true // NAT64 — mapeia IPv4 interno
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true // discard-only
  if (g[0] >= 0xfc00 && g[0] <= 0xfdff) return true // ULA fc00::/7
  // fe80::/10 link-local, fec0::/10 site-local (obsoleto) e ff00::/8 multicast,
  // numa comparação só. `fe80:` como prefixo de STRING cobria só fe80, não febf.
  if (g[0] >= 0xfe80) return true
  if (g[0] === 0x2001 && g[1] === 0x0000) return true // Teredo
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentação
  if (g[0] === 0x2001 && g[1] >= 0x10 && g[1] <= 0x2f) return true // ORCHID / ORCHIDv2
  if (g[0] === 0x2001 && g[1] === 0x0002 && g[2] === 0) return true // benchmarking
  if (g[0] === 0x2002) return true // 6to4 — idem NAT64
  if (g[0] === 0x3fff) return true // documentação (RFC 9637)
  // Fora de 2000::/3 nada é global unicast — é reservado pela IANA.
  if (g[0] < 0x2000 || g[0] > 0x3fff) return true

  // ATENÇÃO: `2001:` não pode virar regra de prefixo. 2001:4860:4860::8888 é o
  // DNS do Google. Só as sub-faixas acima são reservadas.
  return false
}

export async function assertPublicUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use uma URL pública HTTP/HTTPS sem credenciais.')
  }
  // Sem restrição de porta dava para falar com Redis, Memcached, Elasticsearch
  // ou Postgres num host que resolvesse publicamente.
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('Apenas as portas 80 e 443 são permitidas.')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Endereço local não é permitido.')
  }
  // `new URL()` aceita host decimal (http://2130706433/), octal (0177.0.0.1) e
  // hexadecimal (0x7f000001); isIP() devolve 0 para todos e o lookup resolveria.
  // Só vale checar DEPOIS do isIP(): a versão anterior usava /^\d+$/ e
  // /^0[0-7]+/, que rejeitava domínios reais (007.com, 012.com.br) e ainda
  // deixava passar 0x7f000001 e 127.1.
  if (!isIP(hostname) && hostname.split('.').every((label) => /^(0x[0-9a-f]+|\d+)$/.test(label))) {
    throw new Error('Formato de endereço não suportado.')
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true })
  // Política deliberada: UM endereço privado reprova o host inteiro.
  // Não troque por "aceita se algum for público" — o fetch() resolve de novo,
  // de forma independente, e o Happy Eyeballs costuma preferir o AAAA. Um host
  // com A=público e AAAA=::1 passaria na checagem e conectaria no loopback.
  const offending = addresses.find((item) => privateAddress(item.address))
  if (!addresses.length || offending) {
    throw new Error(
      `O link aponta para uma rede privada ou reservada${offending ? ` (${offending.address})` : ''}.`
    )
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>
  timeoutMs?: number
  maxRedirects?: number
}

/**
 * `fetch` com a guarda aplicada em CADA salto de redirecionamento.
 *
 * Revalidar a cada hop é a parte que costuma faltar: sem isso, um host público
 * que responde 302 para http://169.254.169.254/ derrota a validação inicial.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { headers = {}, timeoutMs = 15_000, maxRedirects = 4 } = options
  let target = new URL(rawUrl)
  let response: Response | null = null

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicUrl(target)
    response = await fetch(target.toString(), {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    })
    if (!REDIRECT_STATUS.includes(response.status)) return response
    const location = response.headers.get('location')
    if (!location) return response
    target = new URL(location, target)
  }
  if (!response) throw new Error('Não foi possível acessar o endereço.')
  return response
}

/**
 * Lê o corpo com teto de bytes, abortando o stream ao estourar.
 *
 * `await response.text()` não tem limite: uma resposta de 2 GB derruba a função
 * por memória. O teto é aplicado enquanto o corpo chega, não depois.
 */
export async function readCappedText(response: Response, maxBytes = 5 * 1024 * 1024): Promise<string> {
  const body = response.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}
