import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight, Check, Circle } from 'lucide-react'

const benefits = [
  {
    title: 'Antecipe riscos',
    description: 'Identifique mudanças de narrativa antes que se tornem crises.',
  },
  {
    title: 'Encontre oportunidades',
    description: 'Revele pautas, movimentos e espaços de posicionamento.',
  },
  {
    title: 'Decida com contexto',
    description: 'Transforme notícias dispersas em leitura estratégica e ação.',
  },
]

const solutions = [
  {
    number: '01',
    title: 'Monitorar',
    description: 'Reúne fontes jornalísticas, institucionais e conteúdos recebidos.',
  },
  {
    number: '02',
    title: 'Qualificar',
    description: 'Separa evidência relevante, contexto e ruído para cada cliente.',
  },
  {
    number: '03',
    title: 'Interpretar',
    description: 'Conecta sinais em narrativas, riscos e oportunidades.',
  },
  {
    number: '04',
    title: 'Alertar',
    description: 'Destaca movimentos que exigem atenção e resposta rápida.',
  },
  {
    number: '05',
    title: 'Relatar',
    description: 'Produz análises executivas, cenários e recomendações.',
  },
  {
    number: '06',
    title: 'Preservar',
    description: 'Mantém histórico, decisões editoriais e rastreabilidade.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Detectar',
    description: 'Captura sinais em fontes jornalísticas, institucionais e materiais recebidos.',
  },
  {
    number: '02',
    title: 'Compreender',
    description: 'Qualifica relevância, cruza evidências e identifica o movimento por trás da notícia.',
  },
  {
    number: '03',
    title: 'Agir',
    description: 'Converte contexto em alertas, cenários, recomendações e relatórios executivos.',
  },
]

const planFeatures = [
  'Monitoramento e qualificação contínuos',
  'Alertas e painéis de inteligência',
  'Relatórios e evidências rastreáveis',
  'Memória editorial por cliente',
]

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="CORTEX">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full border ${
          inverse ? 'border-white/50' : 'border-[#0d342a]/40'
        }`}
        aria-hidden="true"
      >
        <span className={`h-2 w-2 rounded-full ${inverse ? 'bg-[#b7d8c8]' : 'bg-[#174d3d]'}`} />
      </span>
      <span className="text-[13px] font-semibold tracking-[0.18em]">CORTEX</span>
    </span>
  )
}

function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div
      className={`mb-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] ${
        light ? 'text-white/50' : 'text-[#48645b]'
      }`}
    >
      <span className={`h-px w-8 ${light ? 'bg-white/30' : 'bg-[#174d3d]/40'}`} />
      {children}
    </div>
  )
}

function SolutionCard({ number, title, description }: (typeof solutions)[number]) {
  return (
    <article className="group flex min-h-52 flex-col justify-between border border-white/15 p-6 transition-colors duration-300 hover:bg-white/[0.04] sm:p-7">
      <div className="flex items-start justify-between">
        <span className="text-[10px] tracking-[0.2em] text-white/35">{number}</span>
        <ArrowUpRight className="h-4 w-4 text-white/35 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#b7d8c8]" />
      </div>
      <div>
        <h3 className="text-2xl font-light tracking-tight">{title}</h3>
        <p className="mt-3 max-w-xs text-sm leading-6 text-white/48">{description}</p>
      </div>
    </article>
  )
}

function PlanCard({ annual = false }: { annual?: boolean }) {
  return (
    <article
      className={`relative flex min-h-[470px] flex-col justify-between border p-7 sm:p-9 ${
        annual ? 'border-[#174d3d] bg-[#174d3d] text-white' : 'border-black/15 bg-[#f5f4ef] text-[#111512]'
      }`}
    >
      {annual && (
        <span className="absolute right-6 top-6 rounded-full border border-white/25 bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#174d3d]">
          Melhor escolha
        </span>
      )}
      <div>
        <p className={`text-[10px] uppercase tracking-[0.2em] ${annual ? 'text-white/55' : 'text-[#48645b]'}`}>
          Plano {annual ? 'anual' : 'mensal'}
        </p>
        <h3 className="mt-8 text-3xl font-light tracking-tight">
          {annual ? 'Compromisso que economiza.' : 'Flexibilidade mês a mês.'}
        </h3>
        <div className="mt-10 flex items-end gap-2 border-b border-current/15 pb-8">
          <span className="text-sm">R$</span>
          <span className="text-6xl font-light tracking-[-0.06em]">—</span>
          <span className={`pb-1 text-xs ${annual ? 'text-white/55' : 'text-black/45'}`}>/ mês</span>
        </div>
        {annual && (
          <p className="mt-4 inline-flex bg-[#dce9e2] px-3 py-2 text-xs font-medium text-[#174d3d]">
            Economize —% no plano anual
          </p>
        )}
      </div>
      <ul className="mt-10 space-y-3">
        {planFeatures.map((feature) => (
          <li key={feature} className={`flex items-center gap-3 text-sm ${annual ? 'text-white/72' : 'text-black/62'}`}>
            <Check className="h-3.5 w-3.5 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function LandingPage() {
  return (
    <div className="overflow-hidden bg-[#efeee9] text-[#111512]">
      <section className="relative min-h-[760px] bg-[#0b0e0c] text-white lg:min-h-[860px]">
        <Image
          src="/images/landing/cortex-hero.jpg"
          alt="Ambiente de análise estratégica com arquitetura de vidro e luzes de dados"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,6,.82)_0%,rgba(5,8,6,.48)_47%,rgba(5,8,6,.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,6,.34)_0%,transparent_42%,rgba(5,8,6,.88)_100%)]" />

        <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-6 py-7 lg:px-10">
          <Link href="/" className="transition-opacity hover:opacity-70" aria-label="CORTEX — início">
            <BrandMark inverse />
          </Link>
          <nav
            className="hidden items-center gap-8 text-[10px] tracking-[0.08em] text-white/65 md:flex"
            aria-label="Navegação principal"
          >
            <a href="#plataforma" className="transition-colors hover:text-white">
              Plataforma
            </a>
            <a href="#solucoes" className="transition-colors hover:text-white">
              Soluções
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-white">
              Como funciona
            </a>
            <a href="#planos" className="transition-colors hover:text-white">
              Planos
            </a>
          </nav>
          <Link
            href="/news"
            className="inline-flex items-center gap-3 rounded-full bg-[#dce9e2] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#174d3d] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Entrar
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[650px] max-w-[1240px] items-center px-6 pb-20 pt-20 lg:px-10">
          <div className="max-w-4xl">
            <p className="mb-7 text-[10px] uppercase tracking-[0.24em] text-[#b7d8c8]">Inteligência de comunicação</p>
            <h1 className="max-w-4xl text-[clamp(3.2rem,7.6vw,7.5rem)] font-light leading-[0.92] tracking-[-0.065em]">
              Transforme sinais em decisões estratégicas.
            </h1>
            <p className="mt-9 max-w-xl text-sm leading-6 text-white/62 sm:text-base sm:leading-7">
              Inteligência de notícias e reputação para antecipar riscos, revelar oportunidades e orientar cada
              movimento.
            </p>
          </div>
        </div>

        <a
          href="#plataforma"
          aria-label="Ir para a seção Plataforma"
          className="absolute bottom-8 right-6 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white/65 transition-colors hover:border-white/60 hover:text-white lg:right-10"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </a>
      </section>

      <section id="plataforma" className="scroll-mt-0 bg-[#0b0e0c] pb-28 pt-20 text-white sm:pb-36 sm:pt-28">
        <div className="mx-auto max-w-[1060px] px-6 lg:px-10">
          <SectionLabel light>Por que o CORTEX</SectionLabel>
          <div className="divide-y divide-white/15 border-y border-white/15">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="grid gap-3 py-7 sm:grid-cols-[0.9fr_1.25fr] sm:gap-12 sm:py-8">
                <h2 className="text-xl font-light tracking-tight sm:text-2xl">{benefit.title}</h2>
                <p className="max-w-xl text-sm leading-6 text-white/48">{benefit.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-24 grid auto-rows-[210px] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative overflow-hidden sm:row-span-2">
              <Image
                src="/images/landing/cortex-signals.jpg"
                alt="Fragmentos de informação convergindo em uma estrutura organizada"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-between bg-[#dce9e2] p-7 text-[#174d3d]">
              <p className="text-[10px] uppercase tracking-[0.18em]">Monitoramento</p>
              <div>
                <p className="text-4xl font-light tracking-tight">Contínuo</p>
                <p className="mt-2 text-xs text-[#174d3d]/65">Fontes jornalísticas e institucionais em um só fluxo.</p>
              </div>
            </div>
            <div className="relative overflow-hidden sm:row-span-2">
              <Image
                src="/images/landing/cortex-collaboration.jpg"
                alt="Equipe analisando informações e evidências em conjunto"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-7 pt-20">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Leitura estratégica</p>
                <p className="mt-2 text-2xl font-light">Contexto para decidir</p>
              </div>
            </div>
            <div className="flex flex-col justify-between bg-[#ece8df] p-7 text-[#151815]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-black/45">Inteligência</p>
              <div>
                <p className="text-4xl font-light tracking-tight">Por cliente</p>
                <p className="mt-2 text-xs text-black/50">Critérios próprios para cada contexto e operação.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solucoes" className="scroll-mt-16 bg-[#0b0e0c] pb-32 text-white sm:pb-40">
        <div className="mx-auto grid max-w-[1060px] gap-14 px-6 lg:grid-cols-[0.8fr_1.7fr] lg:px-10">
          <div>
            <SectionLabel light>Nossas soluções</SectionLabel>
            <h2 className="max-w-sm text-4xl font-light leading-[1.05] tracking-[-0.04em] sm:text-5xl">
              O ambiente muda. O CORTEX conecta os sinais.
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-white/48">
              Uma operação contínua que transforma informação dispersa em inteligência útil, verificável e acionável.
            </p>
          </div>
          <div className="grid sm:grid-cols-2">
            {solutions.map((solution) => (
              <SolutionCard key={solution.title} {...solution} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f4f2ed] py-24 sm:py-32">
        <div className="mx-auto max-w-[1060px] px-6 lg:px-10">
          <div className="text-center">
            <SectionLabel>Prova social</SectionLabel>
            <h2 className="text-4xl font-light tracking-[-0.045em] sm:text-5xl">O que nossos clientes dizem</h2>
          </div>
          <div className="mt-14 grid min-h-[390px] border border-black/10 md:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-[300px] overflow-hidden">
              <Image
                src="/images/landing/cortex-collaboration.jpg"
                alt="Profissionais em uma sessão de análise estratégica"
                fill
                sizes="(max-width: 768px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-between bg-[#ded8ce] p-8 sm:p-12">
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">Espaço reservado</p>
              <div>
                <p className="max-w-lg text-2xl font-light leading-tight tracking-[-0.025em] sm:text-3xl">
                  Depoimento de cliente será inserido aqui após aprovação.
                </p>
                <p className="mt-8 text-xs leading-5 text-black/45">
                  Nome, cargo e organização
                  <br />a definir.
                </p>
              </div>
            </div>
          </div>

          <div className="py-24 text-center sm:py-32">
            <h3 className="text-3xl font-light leading-tight tracking-[-0.04em] sm:text-4xl">
              Construído para decisões
              <br />
              que não podem esperar.
            </h3>
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-black/45">
              Espaço reservado para organizações que confiam no CORTEX.
            </p>
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 border-y border-black/10 sm:grid-cols-4">
              {['Logo 01', 'Logo 02', 'Logo 03', 'Logo 04'].map((logo) => (
                <div
                  key={logo}
                  className="grid h-24 place-items-center border-black/10 text-[9px] uppercase tracking-[0.18em] text-black/30 sm:border-r sm:last:border-r-0"
                >
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-16 bg-[#f4f2ed] pb-28 sm:pb-40">
        <div className="mx-auto max-w-[1060px] px-6 lg:px-10">
          <div className="flex flex-col justify-between gap-8 border-t border-black/15 pt-10 sm:flex-row sm:items-end">
            <div>
              <SectionLabel>Como funciona</SectionLabel>
              <h2 className="max-w-xl text-4xl font-light tracking-[-0.05em] sm:text-6xl">Da notícia à decisão.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-black/46">
              Uma sequência clara para detectar movimentos, compreender o contexto e orientar a ação.
            </p>
          </div>
          <div className="mt-14 grid border-l border-t border-black/15 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="flex min-h-[340px] flex-col justify-between border-b border-r border-black/15 p-7 sm:p-9"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.2em] text-black/35">{step.number}</span>
                  {index < steps.length - 1 ? (
                    <ArrowUpRight className="h-4 w-4 rotate-45 text-[#174d3d]" />
                  ) : (
                    <Circle className="h-3 w-3 fill-[#174d3d] text-[#174d3d]" />
                  )}
                </div>
                <div>
                  <h3 className="text-4xl font-light tracking-[-0.04em]">{step.title}</h3>
                  <p className="mt-5 text-sm leading-6 text-black/48">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-16 bg-[#e7e5df] py-24 sm:py-36">
        <div className="mx-auto max-w-[1060px] px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <SectionLabel>Planos</SectionLabel>
              <h2 className="max-w-xl text-4xl font-light leading-[1.05] tracking-[-0.05em] sm:text-6xl">
                Escolha o ritmo da sua operação.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-black/48 lg:justify-self-end">
              Os dois planos oferecem os mesmos recursos. Valores e desconto serão publicados após a definição
              comercial.
            </p>
          </div>
          <div className="mt-14 grid gap-3 md:grid-cols-2">
            <PlanCard />
            <PlanCard annual />
          </div>
        </div>
      </section>

      <section className="bg-[#f4f2ed] py-24 sm:py-36">
        <div className="mx-auto grid min-h-[430px] max-w-[1060px] bg-[#0b0e0c] text-white md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between p-8 sm:p-12">
            <BrandMark inverse />
            <div className="mt-24">
              <h2 className="max-w-lg text-4xl font-light leading-[1.02] tracking-[-0.05em] sm:text-5xl">
                Menos ruído. Mais clareza para agir.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-6 text-white/48">
                Monitoramento deixa de ser uma entrega operacional e passa a funcionar como infraestrutura contínua de
                inteligência.
              </p>
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden">
            <Image
              src="/images/landing/cortex-signals.jpg"
              alt="Camadas de informação sendo organizadas em um padrão estratégico"
              fill
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <footer className="bg-[#f4f2ed] pb-10 pt-16">
        <div className="mx-auto max-w-[1060px] border-t border-black/10 px-6 pt-10 lg:px-10">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div>
              <BrandMark />
              <p className="mt-5 max-w-xs text-xs leading-5 text-black/42">
                Inteligência de notícias, reputação e comunicação estratégica.
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">Navegação</p>
              <div className="mt-5 flex flex-col gap-3 text-xs text-black/55">
                <a href="#plataforma" className="hover:text-black">
                  Plataforma
                </a>
                <a href="#solucoes" className="hover:text-black">
                  Soluções
                </a>
                <a href="#como-funciona" className="hover:text-black">
                  Como funciona
                </a>
                <a href="#planos" className="hover:text-black">
                  Planos
                </a>
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">Institucional</p>
              <p className="mt-5 text-xs leading-5 text-black/40">
                Dados legais e comerciais
                <br />
                serão inseridos posteriormente.
              </p>
            </div>
          </div>
          <div className="mt-16 flex flex-col gap-3 border-t border-black/10 pt-5 text-[9px] text-black/30 sm:flex-row sm:justify-between">
            <p>CORTEX — Inteligência de Comunicação</p>
            <p>Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
