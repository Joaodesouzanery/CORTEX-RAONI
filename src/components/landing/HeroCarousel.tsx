'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Image from 'next/image'

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
  }, [])

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

      <div className="absolute inset-0 z-10" aria-live="off">
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
                className={`absolute inset-x-6 inset-y-0 flex items-center pb-20 pt-20 transition-all ease-in-out motion-reduce:transition-none lg:inset-x-10 ${
                  active ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
                }`}
              >
                <div className="max-w-4xl">
                  <p className="mb-7 text-[10px] uppercase tracking-[0.24em] text-[#b7d8c8]">{slide.sector}</p>
                  <h1 className="max-w-4xl text-[clamp(3rem,7vw,7rem)] font-light leading-[0.94] tracking-[-0.065em]">
                    {slide.title}
                  </h1>
                  <p className="mt-9 max-w-xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                    {slide.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
