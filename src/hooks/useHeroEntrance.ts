import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { splitText } from 'animejs'
import { REDUCED_MOTION_QUERY, registerMotion } from '../lib/motion'

/**
 * Hero's one-time entrance sequence: the `<h1>` splits into words and
 * staggers in, the degree line / intro paragraphs / links cascade after it,
 * and the transit canvas "ignites" — brightness ramping up from 0 alongside
 * a fade-in on its wrapper (`.hero-ignite` in Hero.tsx; Transit.tsx itself is
 * untouched).
 *
 * `useLayoutEffect`, not `useEffect`, so the split + the animation's initial
 * `gsap.set` land before the browser paints — otherwise the plain heading
 * would flash fully visible for a frame before the split spans replace it.
 *
 * `splitText`'s default `accessible: true` is what keeps the `<h1>`'s
 * accessible name intact: it inserts a visually-hidden span holding the
 * original text and marks every generated word span `aria-hidden="true"`, so
 * the accessible-name computation reads the hidden span's full text and
 * skips the animated pieces entirely — screen readers hear "Harshal Dhaduk",
 * not one word (or letter) at a time. Verified via
 * `getByRole('heading', { name: /harshal dhaduk/i })` and axe in Hero.test.tsx
 * and e2e/a11y.spec.ts rather than assumed.
 *
 * `ready` (App.tsx's `!loading`) sequences this against the preloader: the
 * split + `gsap.set(..., {opacity: 0})` below still run as soon as motion is
 * allowed, so nothing ever flashes visible, but the actual timeline — the
 * part a visitor sees — does not build or play until `ready` is true. That
 * keeps the preloader's own fade-out and the hero's entrance from running at
 * once and fighting for the same first second of the page's life.
 */
export function useHeroEntrance(
  rootRef: RefObject<HTMLElement | null>,
  ready: boolean,
) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const heading = root.querySelector<HTMLElement>('[data-hero-name]')
    const items = root.querySelectorAll<HTMLElement>('[data-hero-item]')
    const ignite = root.querySelector<HTMLElement>('.hero-ignite')

    registerMotion()
    const mm = gsap.matchMedia()

    mm.add({ reduced: REDUCED_MOTION_QUERY, all: true }, (context) => {
      const { reduced } = context.conditions as { reduced: boolean }

      // Reduced motion: no splitting, no timeline, no ignition ramp — the
      // heading stays plain text and everything resolves to its end state
      // via the CSS in index.css.
      if (reduced) return

      const splitter = heading ? splitText(heading, { words: true }) : undefined
      const words = splitter?.words ?? []

      gsap.set(items, { opacity: 0, y: 10 })
      if (words.length) gsap.set(words, { opacity: 0, y: 14 })
      if (ignite) gsap.set(ignite, { opacity: 0, filter: 'brightness(0)' })

      // Hold here while the preloader is still covering the page: the split
      // + hides above already ran, so there is nothing to flash, but the
      // timeline itself waits for `ready` — see the doc comment above.
      if (!ready) return () => splitter?.revert()

      const tl = gsap.timeline()
      if (words.length) {
        tl.to(words, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power3.out',
          stagger: 0.04,
        })
      }
      tl.to(
        items,
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.08 },
        words.length ? '-=0.2' : 0,
      )
      if (ignite) {
        tl.to(
          ignite,
          { opacity: 1, filter: 'brightness(1)', duration: 1, ease: 'power2.out' },
          '<',
        )
      }

      return () => {
        tl.kill()
        splitter?.revert()
      }
    })

    return () => mm.revert()
  }, [rootRef, ready])
}
