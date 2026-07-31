import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import gsap from 'gsap'
import Lenis from 'lenis'
import { prefersReducedMotion, registerMotion } from '../lib/motion'

/**
 * Scopes a second Lenis instance to a single horizontally-scrollable element
 * (Projects' project row), independent of the page-level *vertical* instance
 * in `useSmoothScroll`. Both share GSAP's ticker as their clock so neither
 * runs its own rAF loop, and they never fight over an axis: `gestureOrientation:
 * 'horizontal'` here means Lenis's own gesture disambiguation (see
 * `onVirtualScroll` in `lenis/dist/lenis.js`) treats a wheel/trackpad event
 * with `deltaX === 0` as an "unknown gesture" and leaves it completely
 * untouched — a vertical swipe over the row falls through and scrolls the
 * page exactly as it would anywhere else. The page-level instance is the
 * mirror image (default `gestureOrientation: 'vertical'`, so a pure
 * horizontal delta is what IT ignores), so a horizontal swipe scrolls the row
 * and a vertical swipe scrolls the page, never both at once.
 *
 * `wrapper` is the element with `overflow-x: auto` — real native scrolling —
 * so trackpad, touch, shift+wheel and keyboard all work even with this hook
 * disabled entirely, which is exactly what happens under reduced motion: same
 * rule as the page-level instance in `useSmoothScroll`.
 */
export type CardScroll = {
  /** Move by whole cards. Animated through Lenis when it is running, and a
   *  native smooth scroll otherwise — so the buttons work under reduced
   *  motion and before Lenis mounts. */
  step: (direction: -1 | 1) => void
  /** Jump to a card by index, used by the dot indicators. */
  goTo: (index: number) => void
  /** Index of the card nearest the left edge, for the indicator state. */
  index: number
  atStart: boolean
  atEnd: boolean
}

export function useHorizontalScroll(
  ref: RefObject<HTMLElement | null>,
): CardScroll {
  const lenisRef = useRef<Lenis | null>(null)
  const [index, setIndex] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  /** Width of one card plus the gap, measured rather than hard-coded so the
   *  step stays correct if the card width or gap changes in CSS. */
  const cardStride = useCallback(() => {
    const el = ref.current
    const first = el?.querySelector('li')
    if (!el || !first) return 0
    const rect = first.getBoundingClientRect()
    const list = first.parentElement
    const gap = list ? parseFloat(getComputedStyle(list).columnGap || '0') : 0
    return rect.width + (Number.isNaN(gap) ? 0 : gap)
  }, [ref])

  const scrollToX = useCallback(
    (x: number) => {
      const el = ref.current
      if (!el) return
      const max = el.scrollWidth - el.clientWidth
      const target = Math.max(0, Math.min(x, max))
      if (lenisRef.current) lenisRef.current.scrollTo(target)
      else el.scrollTo({ left: target, behavior: 'smooth' })
    },
    [ref],
  )

  const goTo = useCallback(
    (i: number) => scrollToX(i * cardStride()),
    [cardStride, scrollToX],
  )

  const step = useCallback(
    (direction: -1 | 1) => {
      const el = ref.current
      if (!el) return
      const stride = cardStride()
      if (!stride) return
      const current = Math.round(el.scrollLeft / stride)
      scrollToX((current + direction) * stride)
    },
    [cardStride, ref, scrollToX],
  )

  // Indicator state, driven off native scroll so it stays correct however the
  // scroll happened — Lenis, a swipe, a keypress, or a focus jump.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const stride = cardStride()
      setIndex(stride ? Math.round(el.scrollLeft / stride) : 0)
      setAtStart(el.scrollLeft <= 2)
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [cardStride, ref])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    registerMotion()

    const lenis = new Lenis({
      wrapper: el,
      content: (el.firstElementChild as HTMLElement) ?? el,
      orientation: 'horizontal',
      gestureOrientation: 'horizontal',
      // Leave touch native, exactly like the page-level instance — see
      // useSmoothScroll's comment on syncTouch.
      syncTouch: false,
    })

    lenisRef.current = lenis
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)

    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [ref])

  return { step, goTo, index, atStart, atEnd }
}
