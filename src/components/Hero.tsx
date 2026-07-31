import { useRef } from 'react'
import { profile } from '../data/profile'
import { useHeroEntrance } from '../hooks/useHeroEntrance'
import { Transit } from './Transit'

export function Hero({ ready = true }: { ready?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  useHeroEntrance(ref, ready)

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
          {profile.school} · {profile.grad} · {profile.location}
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
          <Transit />
        </div>
        <p className="mt-2 text-center text-[10px] tracking-[0.18em] text-muted uppercase">
          transit photometry · white dwarf
        </p>
      </div>
    </header>
  )
}
