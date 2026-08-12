import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { registerMotion } from '../lib/motion'
import type { CardScroll } from './useHorizontalScroll'

/**
 * Drives the Projects deck from vertical page scroll: `pinRef` (the deck's
 * viewport + controls) gets pinned in place by ScrollTrigger while `trackRef`
 * (the card row) translates horizontally in lockstep with scroll position —
 * `scrub: true` ties the two together exactly, so there is no separate
 * "animation" running on its own clock, only a mapping from scroll position
 * to horizontal offset. This hook is only ever mounted when motion is
 * allowed; the `prefers-reduced-motion` fallback renders the old natively-
 * scrollable row via `useHorizontalScroll` instead and never touches this.
 *
 * Only one thing scrolls the page under this mode: native/Lenis vertical
 * scroll. There is deliberately no second, horizontally-scoped Lenis
 * instance here (contrast `useHorizontalScroll`, which the reduced-motion
 * fallback still uses) — a scoped horizontal Lenis has nothing to scroll,
 * since the deck's viewport is `overflow: hidden` and moves via a GSAP
 * transform, not native `scrollLeft`. Two systems fighting over the same
 * axis was the risk the task called out; this avoids it by only ever having
 * one (page scroll) drive the pin.
 *
 * The buttons/dots call `goTo`/`step` below, which do not scroll a region —
 * they tween the *scrollTrigger's own scroll position* (`gsap.to(st, {
 * scroll: ... })`, a documented GSAP pattern for animating to a scroll
 * value tied to a trigger). That is the same value the pin's `scrub` reads
 * every frame, so a button click and a wheel scroll move the identical
 * source of truth rather than the buttons nudging some separate, competing
 * offset.
 */
export function useProjectsPin(
  pinRef: RefObject<HTMLElement | null>,
  viewportRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLElement | null>,
): CardScroll {
  const [index, setIndex] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const stRef = useRef<ScrollTrigger | null>(null)

  /** How far the track has to travel horizontally to reach its last card —
   *  also how much *extra* vertical scroll the pin holds for. */
  const distance = useCallback(() => {
    const track = trackRef.current
    const viewport = viewportRef.current
    if (!track || !viewport) return 0
    const last = track.lastElementChild as HTMLElement | null
    if (!last) return 0
    // Measured from the last card rather than read off `scrollWidth`. Once a
    // flex container's content overflows, `scrollWidth` stops accounting for
    // the trailing padding — so the pin released while the track still had
    // that much travel left, and the deck could never be scrolled fully to
    // the right before the page moved on to the next section.
    //
    // `offsetLeft`/`offsetWidth` are layout values and so are immune to the
    // GSAP transform already sitting on the track; reading a bounding rect
    // here would fold the current scroll progress back into the measurement.
    const padRight = parseFloat(getComputedStyle(track).paddingRight) || 0
    const contentWidth = last.offsetLeft + last.offsetWidth + padRight
    return Math.max(0, contentWidth - viewport.clientWidth)
  }, [trackRef, viewportRef])

  /** Number of cards in the deck, read live so it tracks the data. */
  const cardCount = useCallback(
    () => trackRef.current?.children.length ?? 0,
    [trackRef],
  )

  const goTo = useCallback(
    (i: number) => {
      const st = stRef.current
      const count = cardCount()
      if (!st || count < 2) return
      // Index maps evenly across the travel rather than by card stride.
      // Stride-based mapping put card `i` flush at the left edge, which the
      // final cards can never reach — the track stops once its right edge
      // meets the viewport's, so the last card comes to rest on the right.
      // That left the deck's own end state unreachable by index, and the last
      // dot consequently never lit. Even spacing makes index 0 and index
      // count-1 exactly the two ends of the scroll, which is what the dots
      // claim to represent.
      const progress = Math.max(0, Math.min(1, i / (count - 1)))
      const target = st.start + progress * (st.end - st.start)
      gsap.to(st, {
        scroll: target,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: true,
      })
    },
    [cardCount],
  )

  const step = useCallback(
    (direction: -1 | 1) => goTo(index + direction),
    [goTo, index],
  )

  useEffect(() => {
    const pin = pinRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!pin || !viewport || !track) return

    registerMotion()

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        // 'top top' is correct *because* the pinned element is a full-viewport
        // box with its contents vertically centred (see Projects.tsx). The
        // element's top meeting the viewport top therefore puts the cards in
        // the middle of the screen, not jammed against the edge — so the pin
        // engages early in terms of where the content appears, and whatever
        // vertical space is left over splits evenly above and below instead of
        // collecting into a void underneath. An earlier attempt used a
        // percentage offset with an auto-height box, which anchored the block
        // near the top and dumped all the slack below it.
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: true,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Inverse of goTo's mapping, so the highlighted dot and the dot you
          // can click always mean the same position.
          const count = cardCount()
          const i = count > 1 ? Math.round(self.progress * (count - 1)) : 0
          setIndex(i)
          setAtStart(self.progress <= 0.001)
          setAtEnd(self.progress >= 0.999)
        },
      },
    })

    stRef.current = tween.scrollTrigger ?? null

    // The pin distance depends on the cards' rendered width, which depends
    // on the webfont having actually loaded — refreshing after fonts settle
    // (and on resize) keeps the pin's end point matching the real layout
    // instead of whatever jumpy pre-font-swap metrics were true at mount.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('resize', refresh)
    document.fonts?.ready.then(refresh).catch(() => {})

    // Keyboard/AT path: a card's link scrolling into focus (Tab) has no
    // native scrollable ancestor to lean on any more — the viewport is
    // `overflow: hidden`, not scrollable — so without this, a focused card
    // translated out of view stays out of view. Bringing the pin to that
    // card's position on focus keeps Tab a usable way to reach every card,
    // not just a way to reach the buttons.
    // `.closest('li')` is not enough here: EntryBody's own link list is also
    // an `<li>`-per-item `<ul>` nested inside each card, so the nearest `<li>`
    // ancestor of a focused link is often that inner one, not the card's own
    // root `<li>`. Walking up until an `<li>` is a *direct* child of `track`
    // finds the actual card regardless of how much markup sits between it
    // and the focused element.
    const onFocusIn = (event: FocusEvent) => {
      let el = event.target as Element | null
      while (el && el !== track) {
        if (el.tagName === 'LI' && el.parentElement === track) {
          const i = Array.from(track.children).indexOf(el)
          if (i >= 0) goTo(i)
          return
        }
        el = el.parentElement
      }
    }
    track.addEventListener('focusin', onFocusIn)

    return () => {
      window.removeEventListener('resize', refresh)
      track.removeEventListener('focusin', onFocusIn)
      tween.scrollTrigger?.kill()
      tween.kill()
      stRef.current = null
    }
    // goTo is intentionally omitted: it is stable in behaviour (reads refs
    // fresh each call) and including it would tear the pin down and rebuild
    // it every time `index` changes, i.e. on every scroll tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinRef, viewportRef, trackRef, cardCount, distance])

  return { step, goTo, index, atStart, atEnd }
}
