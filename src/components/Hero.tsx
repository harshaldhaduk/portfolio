import { Suspense, lazy, useRef } from 'react'
import { profile } from '../data/profile'
import { useHeroEntrance } from '../hooks/useHeroEntrance'
import { REST_VIEW, Transit } from './Transit'

/**
 * Split out of the main bundle: three.js is by far the heaviest thing the
 * site ships, and holding first paint hostage to it for a decorative hero
 * graphic is the wrong trade. The preloader covers the page for roughly two
 * seconds anyway, which is ample time for this chunk to arrive, and the
 * fallback below reserves the exact final height so nothing shifts when it
 * does.
 */
const OrbitScene = lazy(() =>
  import('./OrbitScene').then((m) => ({ default: m.OrbitScene })),
)

export function Hero({ ready = true }: { ready?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  useHeroEntrance(ref, ready)
  // Shared by the orbit and the light curve so the trace can respond to the
  // viewing angle without re-rendering the hero on every frame of a drag.
  const viewRef = useRef({ ...REST_VIEW })

  return (
    <header
      ref={ref}
      className="grid gap-10 pt-4 pb-20 sm:grid-cols-[1.15fr_1fr] sm:items-center sm:gap-8"
    >
      <div>
        <h1
          data-hero-name
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {profile.name}
        </h1>
        <p
          data-hero-item
          className="mt-3 text-xs tracking-wider text-dwarf"
        >
          {profile.degree}
        </p>
        <p data-hero-item className="mt-1 text-xs text-muted">
          {/* Graduation date deliberately not shown. `profile.grad` is still
              carried in the data for anything else that wants it. */}
          {profile.school} · {profile.location}
        </p>

        {profile.intro.map((line) => (
          <p
            key={line}
            data-hero-item
            className="mt-5 text-[15px] leading-relaxed text-ink/85"
          >
            {line}
          </p>
        ))}

        <ul data-hero-item className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
          {profile.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="link-sweep text-xs text-muted">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="order-first sm:order-none">
        <div className="hero-ignite">
          <Suspense
            fallback={<div aria-hidden="true" className="h-[260px] w-full sm:h-[300px]" />}
          >
            <OrbitScene ready={ready} viewRef={viewRef} />
          </Suspense>
          <Transit viewRef={viewRef} />
        </div>
        <p className="mt-2 text-center text-[10px] tracking-[0.18em] text-muted uppercase">
          transit photometry · white dwarf · drag to rotate
        </p>
      </div>
    </header>
  )
}
