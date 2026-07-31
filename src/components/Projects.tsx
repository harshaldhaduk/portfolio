import { useRef } from 'react'
import { projects } from '../data/projects'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { useHorizontalScroll, type CardScroll } from '../hooks/useHorizontalScroll'
import { useProjectsPin } from '../hooks/useProjectsPin'
import { SectionHeader } from './SectionHeader'
import { ProjectCard } from './ProjectCard'

const REGION_LABEL = 'Projects — a scrollable deck of cards'

/**
 * Controls carry the affordance the hidden scrollbar no longer does. Real
 * buttons, so they are keyboard-operable and announced, rather than
 * decorative arrows. Disabled at the ends instead of silently doing nothing.
 * Shared between both motion modes below — both `useHorizontalScroll` and
 * `useProjectsPin` return the identical `CardScroll` shape, so this is the
 * one place button/dot markup lives regardless of which drives it.
 */
function DeckControls({ deck }: { deck: CardScroll }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={() => deck.step(-1)}
        disabled={deck.atStart}
        aria-label="Previous project"
        className="deck-button"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => deck.step(1)}
        disabled={deck.atEnd}
        aria-label="Next project"
        className="deck-button"
      >
        →
      </button>

      {/* Position indicator. aria-hidden because the buttons above and the
          cards themselves already convey position to assistive tech; a live
          list of dots would just be noise. */}
      <ol aria-hidden="true" className="ml-1 flex items-center gap-1.5">
        {projects.map((project, i) => (
          <li key={project.id}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => deck.goTo(i)}
              data-cursor-target
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === deck.index
                  ? 'w-5 bg-dwarf'
                  : 'w-1.5 bg-hairline hover:bg-muted'
              }`}
            />
          </li>
        ))}
      </ol>

      <span className="ml-auto text-[11px] text-muted">
        {String(deck.index + 1).padStart(2, '0')} /{' '}
        {String(projects.length).padStart(2, '0')}
      </span>
    </div>
  )
}

/**
 * `prefers-reduced-motion` fallback: the original, natively-scrollable
 * `overflow-x-auto` row. Pinning hijacks scroll, which is exactly what that
 * preference asks to skip, so under reduced motion there is no ScrollTrigger
 * pin at all — trackpad, touch swipe, shift+wheel, arrow keys and
 * focus-driven scrolling all keep working exactly as before, and the buttons
 * fall back to a native smooth scroll via `useHorizontalScroll`.
 */
function ProjectsStatic() {
  const reveal = useSectionReveal<HTMLDivElement>()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const deck = useHorizontalScroll(scrollerRef)

  return (
    <>
      <SectionHeader glyph="⬢" label="Projects" />
      <div
        ref={(node) => {
          reveal.current = node
          scrollerRef.current = node
        }}
        role="region"
        aria-label={REGION_LABEL}
        tabIndex={0}
        data-cursor-target
        className="deck-scroller snap-x snap-mandatory overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-dwarf focus-visible:outline-offset-4"
      >
        <ul className="flex gap-5 pb-1">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      </div>
      <DeckControls deck={deck} />
    </>
  )
}

/**
 * Default motion: vertical page scroll drives horizontal card travel.
 * `pinRef` — the viewport plus the controls beneath it — is what
 * ScrollTrigger pins in place; the header above it scrolls away normally
 * first, then this holds while the track travels, then releases and the
 * rest of the page (Systems, the footer) continues scrolling normally. See
 * `useProjectsPin`'s doc comment for how the buttons and the pin share one
 * scroll position, and why there is no scoped horizontal Lenis here.
 */
function ProjectsPinned() {
  const reveal = useSectionReveal<HTMLUListElement>()
  const pinRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const deck = useProjectsPin(pinRef, viewportRef, trackRef)

  return (
    // Full viewport height with its contents centred: this is what stops the
    // leftover vertical space piling up beneath the deck. The box is what gets
    // pinned, the content sits in the middle of it, so the slack is shared
    // between above and below and reads as breathing room rather than a gap.
    <div ref={pinRef} className="flex min-h-screen flex-col justify-center">
      {/* Inside the pinned element on purpose: the label stays with the deck
          for the whole hold, so the section reads as one held unit instead of
          a row of cards floating alone once the header has scrolled off. */}
      <SectionHeader glyph="⬢" label="Projects" />
      <div
        ref={viewportRef}
        role="region"
        aria-label={REGION_LABEL}
        tabIndex={0}
        data-cursor-target
        // `overflow-clip`, not `overflow-hidden`: hidden still establishes a
        // scroll container, which means focusing an off-screen (transformed)
        // card makes the *browser* scroll this element's own scrollLeft to
        // reveal it — fighting the GSAP transform driving the same visual
        // position and the goTo() call below that already handles focus by
        // moving the pin. `clip` clips identically but creates no scroll
        // container at all, so there is nothing left for the browser to
        // scroll here.
        className="overflow-clip focus-visible:outline focus-visible:outline-2 focus-visible:outline-dwarf focus-visible:outline-offset-4"
      >
        <ul
          ref={(node) => {
            reveal.current = node
            trackRef.current = node
          }}
          className="flex gap-5 pb-1"
        >
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      </div>
      <DeckControls deck={deck} />
    </div>
  )
}

/**
 * A card scroller rather than a scrollbar row.
 *
 * Which of the two implementations above renders is decided by
 * `usePrefersReducedMotion`, which reacts if the visitor changes the OS
 * preference mid-session — so toggling it swaps the mechanism cleanly via
 * React unmounting one branch and mounting the other, rather than trying to
 * retrofit one mechanism to behave like both.
 */
export function Projects() {
  const reduced = usePrefersReducedMotion()

  return (
    <section className="pb-20">
      {reduced ? <ProjectsStatic /> : <ProjectsPinned />}
    </section>
  )
}
