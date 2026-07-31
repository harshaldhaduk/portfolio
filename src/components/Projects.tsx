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
    <div className="mt-5 flex items-center gap-1.5">
      {projects.map((project, i) => (
        <button
          key={project.id}
          type="button"
          onClick={() => deck.goTo(i)}
          aria-label={`Show ${project.org}`}
          data-cursor-target
          className={`block h-1.5 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-dwarf focus-visible:outline-offset-4 ${
            i === deck.index ? 'w-6 bg-dwarf' : 'w-1.5 bg-hairline hover:bg-muted'
          }`}
        />
      ))}
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
        className="deck-scroller relative left-1/2 w-screen -translate-x-1/2 snap-x snap-mandatory overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-dwarf focus-visible:outline-offset-4"
      >
        <ul className="flex items-start gap-6 pb-1 pl-[max(1.5rem,calc((100vw-64rem)/2))] pr-[15vw]">
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
    // Vertically centred in the pinned viewport. The block is header + frame +
    // caption, comfortably shorter than the viewport, so centring reads as
    // deliberate framing and splits any slack evenly rather than pooling it
    // under the row. (An earlier arrangement had to be top-aligned because the
    // column was a card stacked over an image and ran tall; flipping to
    // frame-on-top with the caption beneath made the block short enough to
    // centre again.)
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
        className="relative left-1/2 w-screen -translate-x-1/2 overflow-clip focus-visible:outline focus-visible:outline-2 focus-visible:outline-dwarf focus-visible:outline-offset-4"
      >
        <ul
          ref={(node) => {
            reveal.current = node
            trackRef.current = node
          }}
          className="flex items-start gap-6 pb-1 pl-[max(1.5rem,calc((100vw-64rem)/2))] pr-[15vw]"
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
