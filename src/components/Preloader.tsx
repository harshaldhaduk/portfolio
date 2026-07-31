import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion, registerMotion } from '../lib/motion'

/**
 * Belt-and-braces ceiling: whatever the GSAP timeline does, `onDone` fires
 * by this point regardless — an interrupted animation, a thrown error mid
 * timeline, or any other failure to reach `onComplete` still cannot strand
 * the overlay over the page.
 */
const HARD_TIMEOUT_MS = 2500

/**
 * A brief, quiet preloader shown on first load, themed to match the site's
 * white-dwarf hero: a ring fades and scales in, holds, then the whole
 * overlay fades out to reveal the page.
 *
 * Sits in an `aria-hidden` overlay ABOVE the page rather than replacing it —
 * `App`'s real content is in the DOM the entire time this is visible, so
 * assistive tech and crawlers see the page immediately regardless of
 * whether this is still on top of it.
 *
 * Self-contained: checks reduced motion itself (renders nothing, calls
 * `onDone` immediately) rather than relying on its caller to skip rendering
 * it, so the "no preloader under reduced motion" guarantee holds even if a
 * future caller forgets to gate it.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      onDone()
    }

    if (reduced) {
      finish()
      return
    }

    const timeout = window.setTimeout(finish, HARD_TIMEOUT_MS)

    registerMotion()
    const el = overlayRef.current
    let tl: gsap.core.Timeline | undefined

    if (el) {
      const ring = el.querySelector<HTMLElement>('[data-preloader-ring]')
      tl = gsap.timeline({ onComplete: finish })
      if (ring) {
        tl.fromTo(
          ring,
          { opacity: 0, scale: 0.6 },
          { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' },
        )
      }
      tl.to(
        el,
        { opacity: 0, duration: 0.4, ease: 'power1.out' },
        ring ? '+=0.25' : 0,
      )
    } else {
      finish()
    }

    return () => {
      window.clearTimeout(timeout)
      tl?.kill()
    }
  }, [onDone, reduced])

  if (reduced) return null

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-void"
    >
      <span
        data-preloader-ring
        className="h-10 w-10 rounded-full border border-dwarf/50 bg-dwarf/10 opacity-0 shadow-[0_0_24px_-2px_rgba(169,200,255,0.6)]"
      />
    </div>
  )
}
