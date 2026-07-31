import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { prefersReducedMotion, registerMotion } from '../lib/motion'

/**
 * Inertial smooth scrolling, driven from GSAP's ticker so ScrollTrigger and
 * Lenis share one clock instead of each running their own loop and drifting.
 *
 * Lenis is deliberately NOT initialised when the visitor has asked for reduced
 * motion. Overriding native scrolling is exactly the kind of motion that
 * request is about, and a smooth-scroll library is not something to soften —
 * it is something to skip. Under that preference this hook is inert and the
 * browser's own scrolling is left completely untouched.
 */
export function useSmoothScroll(): void {
  useEffect(() => {
    if (prefersReducedMotion()) return
    if (typeof window === 'undefined') return

    registerMotion()

    const lenis = new Lenis({
      // Anything longer reads as sluggish rather than smooth, and makes
      // keyboard paging feel disconnected from the key press.
      duration: 0.9,
      // Leave touch devices on native scrolling. Hijacking momentum on a
      // phone fights the platform and is the most common way smooth-scroll
      // libraries end up feeling broken.
      syncTouch: false,
    })

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)

    // Native scrolling still moves the page for keyboard users (arrows, space,
    // PageDown, Home/End) and when the browser scrolls a focused element into
    // view. Lenis reads the real scroll position, so those keep working — but
    // ScrollTrigger needs telling that the position changed by a route it did
    // not animate, or reveals below the fold can be skipped.
    const onNativeScroll = () => ScrollTrigger.update()
    window.addEventListener('scroll', onNativeScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onNativeScroll)
      gsap.ticker.remove(raf)
      lenis.off('scroll', onScroll)
      lenis.destroy()
    }
  }, [])
}
