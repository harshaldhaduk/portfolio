import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { REDUCED_MOTION_QUERY, markAllRevealed, registerMotion } from '../lib/motion'

/**
 * Section-scoped scroll reveal. Finds every `[data-reveal]` element inside
 * the returned ref's container and cascades them in with `ScrollTrigger.batch`,
 * replacing the per-element IntersectionObserver every row used to run
 * independently (see the retired `useReveal`).
 *
 * `ScrollTrigger.batch`, not one trigger for the whole container: each row
 * still gets its own trigger positioned at its own scroll position, so a row
 * several screens below the fold stays untouched (and correctly unrevealed)
 * until the visitor actually scrolls near it — batch only groups the
 * callbacks of rows that cross their trigger within `interval` seconds of
 * each other, so a normal scroll still animates them in as one cascade. A
 * single trigger scoped to the container's own top would instead reveal
 * every row in the section — including ones still several screens
 * below — the moment the container's top merely came into view, which is
 * both a wrong "reveal" (rows nobody has scrolled to are marked as if seen)
 * and, concretely, why an axe run right after `page.goto` started flagging a
 * pre-existing low-contrast row that used to stay hidden (and un-checked)
 * until the visitor actually scrolled to it.
 *
 * Reversible: rows fade back out on `onLeaveBack` (scrolling up past the
 * point they originally revealed at) and fade back in on `onEnter` if the
 * visitor scrolls back down again — the equivalent of a plain ScrollTrigger's
 * `toggleActions: 'play none none reverse'`, expressed as batch callbacks
 * since `toggleActions` itself is not a `ScrollTrigger.batch` option. `once`
 * is gone for the same reason: a row that can only ever reveal once cannot
 * also reverse. Both `reveal` and `hide` set `overwrite: true` so a quick
 * direction change (scroll down, then immediately back up) hands off from
 * whichever tween is still running rather than the two fighting over the
 * same opacity/y.
 *
 * Never stranding a row invisible: `reveal` marks `data-revealed` before
 * animating in, exactly as before. `hide` does the mirror image in the
 * opposite order — it must NOT flip `data-revealed` off before locking the
 * current visual state into an inline style, or the CSS rule
 * `[data-reveal]:not([data-revealed='true']) { opacity: 0 }` would snap the
 * row invisible for a frame before the fade-out tween even starts. So `hide`
 * captures the current opacity/y as an explicit inline style first (inline
 * always wins over the attribute-gated CSS rule), only then clears
 * `data-revealed`, and only then tweens down.
 *
 * Jump-to-bottom safety: a ScrollTrigger's progress is a scroll *position*,
 * not an intersection event, so a scroll delta that skips clean over a row's
 * start/end in one tick (End, Cmd+Down, a hard trackpad flick, a hash link)
 * still recomputes progress from 0 to 1 in that single update — and GSAP
 * explicitly fires the crossed callbacks for that jump rather than silently
 * dropping them (see ScrollTrigger's `update()`, which fires both the
 * "entered" and "left" callback when a scroll skips completely past a
 * trigger). That is the failure mode the old IntersectionObserver had: it
 * only fires on an actual intersection change, so jumping clean over an
 * element without ever intersecting it left the callback never called.
 * `onEnterBack` covers the same jump in the opposite direction by revealing
 * (not reversing) — a hard jump that lands on a row from below must still
 * end up visible, not skipped to hidden.
 */
/**
 * @param hideOnLeave Whether rows also fade back out as they exit the *top*
 *   of the viewport on the way down. On a normal vertical section that is what
 *   makes the reveal symmetric. The Projects deck opts out: its cards leave
 *   the viewport sideways under a pinned horizontal scroll, so tying their
 *   opacity to vertical scroll position fades out cards that are still on
 *   screen and mid-interaction.
 */
export function useSectionReveal<T extends HTMLElement>({
  hideOnLeave = true,
}: { hideOnLeave?: boolean } = {}) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const items = container.querySelectorAll<HTMLElement>('[data-reveal]')
    if (items.length === 0) return

    registerMotion()
    const mm = gsap.matchMedia()

    // A single condition object (rather than two separate matchMedia queries)
    // so the branch only ever depends on one real query — REDUCED_MOTION_QUERY.
    // The "all" key is GSAP matchMedia's special always-active condition
    // (matched by key name, not value): without it, `.add()` only invokes the
    // callback when a query in the object currently matches, so the callback
    // would never run at all while reduced is false.
    mm.add({ reduced: REDUCED_MOTION_QUERY, all: true }, (context) => {
      const { reduced } = context.conditions as { reduced: boolean }

      if (reduced) {
        markAllRevealed(items)
        return
      }

      gsap.set(items, { opacity: 0, y: 12 })

      const reveal = (batch: Element[]) => {
        markAllRevealed(batch)
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.12,
          overwrite: true,
          clearProps: 'all',
        })
      }

      const hide = (batch: Element[]) => {
        // Lock the current visible state into an inline style before
        // touching the attribute, so removing data-revealed cannot cause a
        // one-frame snap to the CSS rule's opacity: 0 ahead of the tween.
        gsap.set(batch, { opacity: 1, y: 0 })
        for (const el of batch) delete (el as HTMLElement).dataset.revealed
        gsap.to(batch, {
          opacity: 0,
          y: 12,
          duration: 0.4,
          ease: 'power2.in',
          stagger: 0.08,
          overwrite: true,
          // Deliberately NO clearProps here, unlike `reveal`. Clearing the
          // inline styles hands the hidden state back to the CSS rule, which
          // is keyed on data-revealed being absent — and `reveal` removes
          // that key *before* its tween starts. With no inline opacity left
          // to hold the row down, flipping the attribute let CSS snap it
          // straight to opacity 1, so the tween then ran 1 -> 1 and the row
          // simply appeared. That is the "scroll down, up, down again and
          // things just pop in" bug. Keeping the end state inline (it matches
          // the CSS resting state anyway, so nothing looks different) leaves
          // `reveal` an explicit 0 to animate up from every time.
        })
      }

      const triggers = ScrollTrigger.batch(items, {
        start: 'top 85%',
        end: 'bottom 15%',
        interval: 0.15,
        // Symmetric in both directions. `onLeave` is what makes rows retreat
        // off the *top* as you continue down — without it a row revealed once
        // stayed lit forever above the fold, so only the bottom edge of the
        // section animated and the top edge just accumulated. With all four
        // callbacks the section behaves the same whichever way you are
        // travelling: rows fade in at the edge you are approaching and fade
        // out at the edge you are leaving, and reversing direction plays the
        // whole thing backwards.
        onEnter: reveal,
        onEnterBack: reveal,
        onLeave: hideOnLeave ? hide : undefined,
        onLeaveBack: hide,
      })

      return () => triggers.forEach((trigger) => trigger.kill())
    })

    return () => mm.revert()
  }, [])

  return ref
}
