import { useEffect, type RefObject } from 'react'
import { animate, createDrawable } from 'animejs'
import { prefersReducedMotion } from '../lib/motion'

/**
 * Draws a LogEntry's timeline connector downward once its row is revealed.
 *
 * The row's `data-revealed` attribute is set by the section-scoped reveal
 * timeline (`useSectionReveal`) on MissionLog's `<ul>`, not by this hook —
 * this just watches that attribute via MutationObserver instead of running
 * its own ScrollTrigger. That keeps the line's draw exactly in sync with its
 * row's fade-in rather than adding a second, separately-timed trigger, and
 * it inherits the reveal's jump-to-bottom handling for free: whatever value
 * the attribute ends up with (including the "already scrolled past" case),
 * this just reacts to it.
 */
export function useConnectorDraw(
  rowRef: RefObject<HTMLElement | null>,
  lineRef: RefObject<SVGLineElement | null>,
) {
  useEffect(() => {
    const row = rowRef.current
    const line = lineRef.current
    if (!row || !line) return

    const [drawable] = createDrawable(line, 0, 0)

    const draw = () => {
      if (prefersReducedMotion()) {
        drawable.setAttribute('draw', '0 1')
        return
      }
      animate(drawable, {
        draw: ['0 0', '0 1'],
        duration: 900,
        ease: 'inOutQuad',
      })
    }

    if (row.dataset.revealed === 'true') {
      draw()
      return
    }

    const observer = new MutationObserver(() => {
      if (row.dataset.revealed === 'true') {
        draw()
        observer.disconnect()
      }
    })
    observer.observe(row, { attributes: true, attributeFilter: ['data-revealed'] })
    return () => observer.disconnect()
  }, [rowRef, lineRef])
}
