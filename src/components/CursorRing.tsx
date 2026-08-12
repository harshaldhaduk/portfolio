import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion, registerMotion } from '../lib/motion'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
// Every interactive or hover-affected target on the page: links, buttons,
// <details> summaries (Expand, in both its default and `role="button"`
// forms), and anything opted in via `data-cursor-target` — the deck region,
// tag chips (TagRow), and project cards (ProjectCard) among them. One
// delegated selector rather than per-element listeners, so anything added
// later just needs the right tag or attribute to be covered automatically.
const INTERACTIVE_SELECTOR =
  'a, button, summary, [role="button"], [data-cursor-target]'

/**
 * A ring that follows the mouse and shrinks over anything clickable.
 * Additive only — the native cursor is never hidden, so OS-level cursor
 * size/colour accessibility settings keep working exactly as before.
 *
 * Rendered conditionally, not just visually inert: on a touch device there
 * is no cursor to follow, and under reduced motion the whole point of this
 * (a smoothed follow via `gsap.quickTo`) is exactly the kind of motion that
 * preference asks to skip. In both cases this renders nothing at all rather
 * than an invisible, idle element.
 */
export function CursorRing() {
  const [enabled, setEnabled] = useState(false)
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!window.matchMedia?.(FINE_POINTER_QUERY).matches) return
    setEnabled(true)
  }, [])

  // Only once the custom cursor is actually on screen. Gated behind the same
  // fine-pointer + motion-allowed check as everything else here, so a touch
  // device or a reduced-motion visitor never loses their real cursor — and
  // the class comes straight back off if this unmounts.
  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add('has-custom-cursor')
    return () => document.documentElement.classList.remove('has-custom-cursor')
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const ring = ringRef.current
    if (!ring) return

    const dot = dotRef.current

    registerMotion()
    gsap.set(ring, { xPercent: -50, yPercent: -50 })
    // Cut from 0.4s: that read as noticeable lag between the pointer and the
    // ring. 0.15s still smooths out jitter without the ring visibly trailing.
    const xTo = gsap.quickTo(ring, 'x', { duration: 0.15, ease: 'power3' })
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.15, ease: 'power3' })

    // The dot is the cursor now, so it tracks far tighter than the ring — the
    // ring is allowed to lag and settle behind it, which is what makes the
    // pair read as one object with weight rather than two things drifting.
    let dotX: ((v: number) => void) | undefined
    let dotY: ((v: number) => void) | undefined
    if (dot) {
      gsap.set(dot, { xPercent: -50, yPercent: -50 })
      dotX = gsap.quickTo(dot, 'x', { duration: 0.04, ease: 'power2' })
      dotY = gsap.quickTo(dot, 'y', { duration: 0.04, ease: 'power2' })
    }

    // Tracks the currently-hovered interactive ancestor (if any) so a
    // pointerout fired by a nested child moving to a sibling inside the same
    // link/button does not briefly grow the ring back out — it only grows
    // once the pointer actually leaves that ancestor, per `relatedTarget`.
    let current: Element | null = null

    const onPointerMove = (event: PointerEvent) => {
      xTo(event.clientX)
      yTo(event.clientY)
      dotX?.(event.clientX)
      dotY?.(event.clientY)
    }

    // Delegated on `document`, not attached per-element, so elements added
    // to the page later are covered automatically.
    const onPointerOver = (event: PointerEvent) => {
      const match = (event.target as Element | null)?.closest?.(
        INTERACTIVE_SELECTOR,
      )
      if (match && match !== current) {
        current = match
        ring.dataset.hovering = 'true'
      }
    }

    const onPointerOut = (event: PointerEvent) => {
      if (!current) return
      const related = event.relatedTarget as Element | null
      if (!related || !current.contains(related)) {
        current = null
        delete ring.dataset.hovering
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)

    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      gsap.killTweensOf(ring)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        data-cursor-ring
        className="pointer-events-none fixed top-0 left-0 z-50 h-14 w-14 rounded-full border border-dwarf/70 transition-[width,height,border-color] duration-200 data-[hovering=true]:h-7 data-[hovering=true]:w-7 data-[hovering=true]:border-dwarf"
      />
      {/*
        The dark collar that used to ring this dot is gone by request, so the
        glow is now the only thing holding it apart from the backdrop. That is
        enough over the sky, which is nearly everything; it is weakest exactly
        where the page is brightest — crossing the white dwarf's disc or a
        bright star — since a pale glow on pale ground has little to say. The
        glow is therefore pushed slightly wider and stronger than it was when
        the collar shared the work.
      */}
      <div
        ref={dotRef}
        aria-hidden="true"
        data-cursor-dot
        className="pointer-events-none fixed top-0 left-0 z-[60] h-2.5 w-2.5 rounded-full bg-dwarf"
        style={{ boxShadow: '0 0 14px 4px rgba(169, 200, 255, 0.6)' }}
      />
    </>
  )
}
