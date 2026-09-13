'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const ROTATION_INTERVAL_MS = 6000

type HeroSlide = {
  image: string
  sector: string
  title: string
  description: string
  desktopPosition: string
  mobilePosition: string
}

type HeroImageStyle = CSSProperties & {
  '--hero-position-desktop': string
  '--hero-position-mobile': string
}

const heroSlides: HeroSlide[] = [
  {
    image: '/images/landing/cortex-sector-energy.jpg',
    sector: 'Sistema elétrico',
    title: 'Transforme complexidade em direção estratégica.',
    description:
      'Conecte decisões regulatórias, operação, mercado e opinião pública em uma visão mais clara do cenário.',
    desktopPosition: 'center 54%',
    mobilePosition: '58% center',
  },
  {
    image: '/images/landing/cortex-sector-waterways.jpg',
    sector: 'Infraestrutura & logística',
    title: 'Leia os movimentos que conectam o país.',
    description:
      'Acompanhe infraestrutura, transportes e políticas públicas antes que mudanças de agenda ganhem escala.',
    desktopPosition: 'center 52%',
    mobilePosition: '58% center',
  },
  {
    image: '/images/landing/cortex-sector-offshore.jpg',
    sector: 'Energia & óleo e gás',
    title: 'Antecipe mudanças em mercados sob pressão.',
    description: 'Monitore narrativas, regulação e reputação em setores que operam sob alta exposição.',
    desktopPosition: 'center 48%',
    mobilePosition: '64% center',
  },
  {
    image: '/images/landing/cortex-sector-mining.jpg',
    sector: 'Mineração & recursos naturais',
    title: 'Enxergue riscos além da superfície.',
    description:
      'Acompanhe operação, território, sustentabilidade e licença social antes que os sinais se tornem crises.',
    desktopPosition: 'center 55%',
    mobilePosition: '55% center',
  },
  {
    image: '/images/landing/cortex-sector-technology.jpg',
    sector: 'Tecnologia & inovação',
    title: 'Identifique hoje as narrativas de amanhã.',
    description:
      'Leia tendências, políticas e mudanças de percepção que abrem espaço para influência e posicionamento.',
    desktopPosition: 'center 52%',
    mobilePosition: '62% center',
  },
]

export default function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [rotationVersion, setRotationVersion] = useState(0)
  const activeIndexRef = useRef(activeIndex)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const selectSlide = useCallback((index: number) => {
    setActiveIndex(index)
    setRotationVersion((version) => version + 1)
  }, [])

  const showPreviousSlide = useCallback(() => {
    selectSlide((activeIndexRef.current - 1 + heroSlides.length) % heroSlides.length)
  }, [selectSlide])

  const showNextSlide = useCallback(() => {
    selectSlide((activeIndexRef.current + 1) % heroSlides.length)
  }, [selectSlide])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let rotationTimer: number | undefined

    const stopRotation = () => {
      if (rotationTimer !== undefined) {
        window.clearInterval(rotationTimer)
        rotationTimer = undefined
      }
    }

    const syncRotation = () => {
      stopRotation()

      if (reducedMotion.matches) {
        setActiveIndex(0)
        return
      }

      if (document.visibilityState !== 'visible') return

      rotationTimer = window.setInterval(() => {
        setActiveIndex((current) => (current + 1) % heroSlides.length)
      }, ROTATION_INTERVAL_MS)
    }

    syncRotation()
    document.addEventListener('visibilitychange', syncRotation)
    reducedMotion.addEventListener('change', syncRotation)

    return () => {
      stopRotation()
      document.removeEventListener('visibilitychange', syncRotation)
      reducedMotion.removeEventListener('change', syncRotation)
    }
  }, [rotationVersion])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      showPreviousSlide()
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      showNextSlide()
    }
  }

  return (
    <>
      <div className="absolute inset-0 z-0 bg-[#0b0e0c]" aria-hidden="true">
        {heroSlides.map((slide, index) => {
          const imageStyle: HeroImageStyle = {
            '--hero-position-desktop': slide.desktopPosition,
            '--hero-position-mobile': slide.mobilePosition,
            transitionDuration: '1200ms',
          }

          return (
            <Image
              key={slide.image}
              src={slide.image}
              alt=""
              fill
              priority={index === 0}
              loading={index === 0 ? 'eager' : undefined}
              sizes="100vw"
              style={imageStyle}
              className={`object-cover [object-position:var(--hero-position-mobile)] transition-opacity ease-in-out motion-reduce:transition-none md:[object-position:var(--hero-position-desktop)] ${
                index === activeIndex ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )
        })}
      </div>

      <div
        className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-white/70"
        role="region"
        aria-label="Destaques setoriais"
        aria-roledescription="carrossel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="relative mx-auto h-full max-w-[1240px]">
          {heroSlides.map((slide, index) => {
            const active = index === activeIndex

            return (
              <div
                key={slide.title}
                data-hero-slide={index}
                data-active={active}
                aria-hidden={!active}
                style={{
                  transitionDuration: active ? '650ms' : '180ms',
                  transitionDelay: active ? '260ms' : '0ms',
                }}
                className={`absolute inset-x-6 inset-y-0 flex items-center pb-28 pt-20 transition-all ease-in-out motion-reduce:transition-none sm:inset-x-16 sm:pb-20 lg:inset-x-20 ${
                  active ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
                }`}
              >
                <div className="max-w-4xl">
                  <p className="mb-7 text-[10px] uppercase tracking-[0.24em] text-[#b7d8c8]">{slide.sector}</p>
                  <h1 className="max-w-4xl text-[clamp(2.55rem,7vw,7rem)] font-light leading-[0.94] tracking-[-0.065em]">
                    {slide.title}
                  </h1>
                  <p className="mt-9 max-w-xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                    {slide.description}
                  </p>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={showPreviousSlide}
            aria-label="Mostrar destaque anterior"
            className="absolute bottom-7 left-6 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-auto sm:left-4 sm:top-1/2 sm:-translate-y-1/2 lg:left-8"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={showNextSlide}
            aria-label="Mostrar próximo destaque"
            className="absolute bottom-7 right-6 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-auto sm:right-4 sm:top-1/2 sm:-translate-y-1/2 lg:right-8"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="absolute bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-2" aria-label="Selecionar destaque">
            {heroSlides.map((slide, index) => {
              const active = index === activeIndex

              return (
                <button
                  key={slide.sector}
                  type="button"
                  onClick={() => selectSlide(index)}
                  aria-label={`Mostrar destaque ${index + 1}: ${slide.sector}`}
                  aria-current={active ? 'true' : undefined}
                  className="group flex h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span
                    className={`block h-px transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                      active ? 'w-10 bg-white' : 'w-6 bg-white/40 group-hover:bg-white/75'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
