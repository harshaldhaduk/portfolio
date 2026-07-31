import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Single place GSAP is configured. Importing this module registers
 * ScrollTrigger exactly once — registering twice is harmless but registering
 * zero times fails silently, with tweens that simply never fire.
 */
let registered = false

export function registerMotion(): void {
  if (registered) return
  gsap.registerPlugin(ScrollTrigger)
  // Without this, GSAP tries to compensate for a dropped frame by jumping the
  // playhead. With ScrollTrigger driving from a smooth-scroll loop that
  // compensation fights the scroll position and produces visible stutter.
  gsap.ticker.lagSmoothing(0)
  registered = true
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false
}

/**
 * The attribute contract shared by the CSS in `src/index.css`, the reveal
 * animations, and the test suite. `src/index.css` holds `[data-reveal]` at
 * opacity 0 and lifts it only on `[data-revealed='true']`, so whatever drives
 * the reveal must set this — including under reduced motion, where nothing
 * animates but everything must still be visible.
 */
export function markRevealed(el: Element): void {
  ;(el as HTMLElement).dataset.revealed = 'true'
}

export function markAllRevealed(els: ArrayLike<Element>): void {
  for (let i = 0; i < els.length; i += 1) markRevealed(els[i])
}
