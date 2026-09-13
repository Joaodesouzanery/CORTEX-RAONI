import { describe, expect, it } from 'vitest'
import { assertPublicUrl } from './safe-fetch'

const rejects = (url: string) => expect(assertPublicUrl(new URL(url))).rejects.toThrow()
const accepts = (url: string) => expect(assertPublicUrl(new URL(url))).resolves.toBeUndefined()

describe('assertPublicUrl', () => {
  it('bloqueia loopback e "este host"', async () => {
    await rejects('http://127.0.0.1/')
    await rejects('http://127.1.2.3/')
    await rejects('http://0.0.0.0/')
    await rejects('http://[::1]/')
    await rejects('http://localhost/')
    await rejects('http://algo.local/')
  })

  it('bloqueia RFC1918 e CGNAT', async () => {
    await rejects('http://10.0.0.1/')
    await rejects('http://172.16.0.1/')
    await rejects('http://172.31.255.254/')
    await rejects('http://192.168.1.1/')
    // 100.64/10 faltava na guarda original — é o range usado por Fly.io,
    // Tailscale e redes de pod do Kubernetes.
    await rejects('http://100.64.0.1/')
    await rejects('http://100.127.255.254/')
  })

  it('bloqueia link-local e metadados de nuvem', async () => {
    await rejects('http://169.254.169.254/latest/meta-data/')
    await rejects('http://[fe80::1]/')
  })

  it('bloqueia faixas reservadas e de teste', async () => {
    await rejects('http://198.18.0.1/') // benchmark
    await rejects('http://192.0.2.1/') // TEST-NET-1
    await rejects('http://198.51.100.1/') // TEST-NET-2
    await rejects('http://203.0.113.1/') // TEST-NET-3
    await rejects('http://224.0.0.1/') // multicast
    await rejects('http://255.255.255.255/')
  })

  it('bloqueia IPv6 privado e as formas que mapeiam IPv4 interno', async () => {
    await rejects('http://[fd00::1]/')
    await rejects('http://[fc00::1]/')
    await rejects('http://[64:ff9b::7f00:1]/') // NAT64
    await rejects('http://[2002:7f00:1::]/') // 6to4
    await rejects('http://[::ffff:127.0.0.1]/')
  })

  it('bloqueia formas alternativas de endereço que o URL aceita', async () => {
    // new URL() aceita as duas; isIP() devolve 0 e o lookup resolveria.
    await rejects('http://2130706433/') // 127.0.0.1 em decimal
    await rejects('http://0177.0.0.1/') // octal
  })

  it('bloqueia esquema, credenciais e porta fora de 80/443', async () => {
    await rejects('ftp://exemplo.com/')
    await rejects('http://user:senha@1.1.1.1/')
    await rejects('http://1.1.1.1:22/')
    await rejects('http://1.1.1.1:6379/') // Redis
    await rejects('http://1.1.1.1:5432/') // Postgres
  })

  it('aceita endereço público em porta padrão', async () => {
    await accepts('https://1.1.1.1/')
    await accepts('http://8.8.8.8:80/')
    await accepts('https://93.184.216.34:443/')
  })
})

// ---------------------------------------------------------------------------
// Este bloco é a regressão que derrubou a coleta e passou no CI.
//
// A versão anterior de `privateAddress` terminava em
// `return normalized.includes(':')`, classificando QUALQUER IPv6 público como
// rede privada. Como o host é reprovado se algum endereço resolvido for
// privado, um único registro AAAA bloqueava tudo — inclusive news.google.com,
// que transporta ~45 das ~50 fontes semeadas, e www.gov.br.
//
// Os testes existentes só cobriam IPv4 público (1.1.1.1, 8.8.8.8), por isso
// não pegaram nada. Endereços abaixo são reais, resolvidos na investigação.
// ---------------------------------------------------------------------------
describe('aceita IPv6 público', () => {
  it('aceita os hosts de que a coleta depende', async () => {
    await accepts('https://[2800:3f0:4004:80d::200e]/') // news.google.com
    await accepts('https://[2804:151:3:2:161:148:164:31]/') // www.gov.br
    await accepts('https://[2606:4700:10::6814:1e32]/') // poder360 (Cloudflare)
    await accepts('https://[2606:4700:3037::ac43:bd5d]/') // portosenavios (Cloudflare)
  })

  it('aceita IPv6 público de infraestrutura conhecida', async () => {
    await accepts('https://[2606:4700:4700::1111]/') // Cloudflare DNS
    // Trava a regra "2001: não é prefixo proibido" — só as sub-faixas são.
    await accepts('https://[2001:4860:4860::8888]/') // Google DNS
    await accepts('https://[2a00:1450:4001:80b::200e]/') // Google EU
    await accepts('https://[2a03:2880:f10c:83:face:b00c:0:25de]/') // Facebook
  })

  it('aceita o bloco IPv4 da Cloudflare, que uma regra ingênua de 172.x destruiria', async () => {
    await accepts('https://172.66.159.186/')
    await accepts('https://172.67.141.61/')
  })

  it('aceita as portas padrão explícitas', async () => {
    // `new URL()` normaliza :80 e :443 para string vazia. Pinado para ninguém
    // "simplificar" a condição de porta e passar a rejeitá-las.
    await accepts('https://1.1.1.1:443/')
    await accepts('http://1.1.1.1:80/')
  })
})

describe('bloqueia a tabela privada/reservada IPv6 por inteiro', () => {
  it('bloqueia loopback, não-especificado e formas mapeadas para IPv4', async () => {
    await rejects('http://[::1]/')
    await rejects('http://[::]/')
    await rejects('http://[::ffff:127.0.0.1]/')
    // As duas formas comprimidas que a versão antiga só bloqueava por acidente:
    await rejects('http://[::ffff:7f00:1]/')
    await rejects('http://[0:0:0:0:0:ffff:127.0.0.1]/')
    await rejects('http://[::ffff:10.0.0.1]/')
    await rejects('http://[::ffff:169.254.169.254]/')
    await rejects('http://[::7f00:1]/') // IPv4-compatível
  })

  it('bloqueia a faixa link-local inteira, não só fe80', async () => {
    await rejects('http://[fe80::1]/')
    await rejects('http://[fe80::202:b3ff:fe1e:8329]/')
    await rejects('http://[fea0::1]/')
    await rejects('http://[febf::1]/') // o fim da /10 — prefixo de string não pegava
    await rejects('http://[fec0::1]/') // site-local obsoleto
  })

  it('bloqueia ULA, multicast e faixas de tradução', async () => {
    await rejects('http://[fc00::1]/')
    await rejects('http://[fd12:3456:789a::1]/')
    await rejects('http://[ff02::1]/')
    await rejects('http://[64:ff9b::7f00:1]/') // NAT64
    await rejects('http://[2002:7f00:1::]/') // 6to4
    await rejects('http://[100::1]/') // discard-only
  })

  it('bloqueia as sub-faixas reservadas de 2001: sem bloquear 2001: inteiro', async () => {
    await rejects('http://[2001::1]/') // Teredo
    await rejects('http://[2001:db8::1]/') // documentação
    await rejects('http://[2001:10::1]/') // ORCHID
    await rejects('http://[2001:2::1]/') // benchmarking
    await rejects('http://[3fff::1]/') // documentação RFC 9637
    await rejects('http://[4000::1]/') // fora de 2000::/3
  })
})

describe('hostnames em formato alternativo', () => {
  it('rejeita as formas numéricas que contornam o isIP()', async () => {
    await rejects('http://2130706433/') // 127.0.0.1 decimal
    await rejects('http://0177.0.0.1/') // octal
    await rejects('http://0x7f000001/') // hexadecimal — a versão antiga deixava passar
    await rejects('http://127.1/') // idem
  })

  it('não trata domínio que começa com dígito como endereço numérico', async () => {
    // A regra antiga (/^0[0-7]+/) rejeitava estes domínios legítimos por
    // formato. Aqui interessa só isso: que a recusa, se houver, seja de DNS e
    // não de formato. Assertar resolução real deixaria o teste dependente de
    // rede — o `.local` no fim é para garantir NXDOMAIN sem tocar na internet.
    for (const host of ['01net.com.local-test.invalid', '0800.com.br.local-test.invalid']) {
      await expect(assertPublicUrl(new URL(`https://${host}/`))).rejects.not.toThrow(
        /Formato de endereço não suportado/
      )
    }
  })
})
