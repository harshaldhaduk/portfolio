import { useEffect, useRef, useState } from 'react'
import NumberFlow from '@number-flow/react'
import gsap from 'gsap'
import { prefersReducedMotion, registerMotion } from '../lib/motion'

/**
 * Belt-and-braces ceiling: whatever the GSAP timeline does, `onDone` fires
 * by this point regardless — an interrupted animation, a thrown error mid
 * timeline, or any other failure to reach `onComplete` still cannot strand
 * the overlay over the page. Comfortably clear of the ~1.9s timeline below,
 * so it only ever acts as a failsafe and never truncates the animation.
 */
const HARD_TIMEOUT_MS = 3000

/**
 * How long the bar and the count take, and in how many jumps.
 *
 * The step count is what sets the pace, not the duration: 100 counts spread
 * over {@link COUNT_STEPS} jumps means each jump is `100 / COUNT_STEPS`, and
 * the tens digit turns over every `COUNT_STEPS / 10` of them. At the previous
 * 100 steps the ones digit moved every frame and the tens only every tenth,
 * which is what made it feel slow to arrive.
 *
 * 50 steps gives a jump of exactly +2, and that exactness is the point: the
 * tens digit then turns over every fifth step, without fail, for the whole
 * count. Any jump that does not divide 10 — +3, or a random 1-3 — makes the
 * tens roll after an uneven number of steps each time, which reads as the
 * number stuttering rather than climbing. Only +1, +2 and +5 keep it even,
 * and +2 is the one that also doubles the pace.
 *
 * Duration is then chosen so one step lands per painted frame (0.7s / 50 =
 * 14ms, against ~16.7ms at 60fps). Going faster than that does not speed the
 * count up, it only means the screen cannot paint every value.
 */
const LOAD_DURATION = 0.7
const COUNT_STEPS = 50

/**
 * First-load preloader: a white bar fills, collapses to a single point, and
 * detonates into a white flash that dissipates to uncover the page — a big
 * bang, with the site as what the bang leaves behind.
 *
 * The four beats are deliberately asymmetric in length. The fill is the only
 * slow one because it is the only one carrying information ("something is
 * loading"); the collapse, bang, and dissipate are all fast so the transition
 * reads as a single impact rather than three queued animations.
 *
 * Sits in an `aria-hidden` overlay ABOVE the page rather than replacing it —
 * `App`'s real content is in the DOM the entire time this is visible, so
 * assistive tech and crawlers see the page immediately regardless of whether
 * this is still on top of it. That is also what makes the final beat work:
 * fading the overlay out uncovers the already-rendered page underneath, so
 * the flash dissipates *into* the site rather than cutting to it.
 *
 * `onDone` fires only at the very end, once the overlay is fully transparent.
 * App unmounts this component the moment it fires, so calling it any earlier
 * would tear the overlay out mid-flash and produce exactly the hard cut this
 * is shaped to avoid.
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
  const [count, setCount] = useState(0)

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
      const bar = el.querySelector<HTMLElement>('[data-preloader-bar]')
      const fill = el.querySelector<HTMLElement>('[data-preloader-fill]')
      const flash = el.querySelector<HTMLElement>('[data-preloader-flash]')
      const shock = el.querySelector<HTMLElement>('[data-preloader-shock]')
      const digits = el.querySelector<HTMLElement>('[data-preloader-digits]')

      tl = gsap.timeline({ onComplete: finish })

      if (bar && fill && flash && shock && digits) {
        // Counts one integer at a time — 0, 1, 2 … 100 — rather than handing
        // NumberFlow the endpoint and letting it roll straight there.
        // `steps(COUNT_STEPS)` is what makes that literal: the tween advances in
        // discrete jumps, so the value genuinely passes through every number
        // instead of sweeping continuously past them.
        //
        // NumberFlow's `transformTiming` is correspondingly short (see below).
        // It has to finish each single-step roll before the next value lands,
        // or every update cancels a half-played transition and the digits
        // smear instead of ticking.
        //
        // Both tweens run linear so the bar and the number stay in literal
        // proportion: at 40 the bar is exactly 40% filled. An eased fill would
        // drift ahead of the count through the middle of the load.
        const counter = { value: 0 }
        let lastPushed = 0
        const pushCount = () => {
          const next = Math.round(counter.value)
          // Guard against redundant renders: onUpdate fires per frame, which
          // is more often than the stepped value actually changes.
          if (next !== lastPushed) {
            lastPushed = next
            setCount(next)
          }
        }

        tl
          .fromTo(
            fill,
            { scaleX: 0 },
            { scaleX: 1, duration: LOAD_DURATION, ease: 'none' },
          )
          .to(
            counter,
            {
              value: 100,
              duration: LOAD_DURATION,
              ease: `steps(${COUNT_STEPS})`,
              onUpdate: pushCount,
            },
            '<',
          )
          // Collapse. The filled bar converges to a point — power3.in so it
          // accelerates inward, reading as energy gathering, not a wipe. The
          // readout leaves with it: a "100" sitting there through the
          // explosion is the counter overstaying its purpose.
          .to(bar, { scaleX: 0.04, duration: 0.18, ease: 'power3.in' })
          .to(digits, { opacity: 0, y: -6, duration: 0.16, ease: 'power2.in' }, '<')
          // Bang, in two layers. A single expanding disc reads as a wipe; what
          // sells an explosion is a fast, bright core with a thin shockwave
          // outrunning it. The core peaks and holds while the ring keeps
          // travelling, so the light appears to *leave* the point of collapse
          // rather than simply grow from it.
          .fromTo(
            flash,
            { scale: 0, opacity: 1 },
            { scale: 1, duration: 0.28, ease: 'expo.out' },
            '>-0.04',
          )
          .fromTo(
            shock,
            { scale: 0, opacity: 0.9, borderWidth: 3 },
            {
              scale: 13,
              opacity: 0,
              borderWidth: 0.5,
              duration: 0.62,
              ease: 'expo.out',
            },
            '<',
          )
          // Dissipate, uncovering the page underneath. Overlaps the shockwave's
          // tail so the reveal is part of the same gesture, not a beat after it.
          .to(el, { opacity: 0, duration: 0.46, ease: 'power2.inOut' }, '<0.22')
      } else {
        tl.to(el, { opacity: 0, duration: 0.4, ease: 'power1.out' })
      }
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
      className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-void"
    >
      <div className="flex flex-col items-center gap-5">
        {/* Timings are short because the value changes every ~14ms. They are
            deliberately a little longer than that interval rather than equal
            to it: each roll is still in flight when the next number lands, and
            that overlap is what turns a sequence of discrete jumps into the
            continuous rolling blur an odometer has. Set them to the step
            interval and the digits snap; set them to NumberFlow's default and
            every transition is cancelled at ~15% and the digits barely move. */}
        {/* `overflow-hidden` is load-bearing, not tidiness. NumberFlow parks
            the spare digits it is rolling toward directly above and below the
            visible one, and normally relies on its own vertical mask to hide
            them — the same mask that draws the soft edge we are removing. With
            that mask zeroed something still has to clip them, so the window
            does it here with a hard edge instead of a fade.

            The padding is what keeps that clip from cutting the number itself,
            and the two axes need very different amounts. Vertically a hair is
            enough to clear tall glyphs, and it has to stay far under the ~1em
            gap to the neighbouring digits or they would come back into view.
            Horizontally NumberFlow gives its inner box a negative margin of
            `--number-flow-mask-width` (0.5em) so digits deliberately paint
            outside the host's own box; overflow clips at the padding edge, so
            the padding has to exceed that margin or the first and last digits
            lose their outer edges. */}
        <div
          data-preloader-digits
          className="overflow-hidden px-[0.6em] py-[0.06em] text-[2.75rem] leading-none font-semibold tracking-tight text-ink tabular-nums"
        >
          <NumberFlow
            data-preloader-count
            value={count}
            transformTiming={{ duration: 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
            opacityTiming={{ duration: 70, easing: 'ease-out' }}
            willChange
          />
        </div>

        <span
          data-preloader-bar
          className="relative block h-px w-56 overflow-hidden rounded-full bg-dwarf/20"
        >
          <span
            data-preloader-fill
            className="absolute inset-0 origin-left scale-x-0 rounded-full bg-white shadow-[0_0_10px_1px_rgba(255,255,255,0.7)]"
          />
        </span>
      </div>
      {/* Sized in vmax so scale: 1 covers the viewport on any aspect ratio.
          The gradient falls off to transparent well before the edge, so the
          bang keeps a bright core with a soft shoulder instead of reading as
          a flat white rectangle. */}
      {/* The shockwave. Starts at the size the collapsed bar leaves behind and
          outruns the core, which is what reads as an explosion rather than a
          disc simply growing. */}
      <span
        data-preloader-shock
        className="pointer-events-none absolute inset-0 m-auto h-24 w-24 scale-0 rounded-full border-[3px] border-white opacity-0"
      />
      <span
        data-preloader-flash
        // `inset-0 m-auto` centres this rather than a translate would, because
        // GSAP writes `transform` wholesale when it scales the burst and would
        // overwrite any centring translate sitting in the class list.
        className="pointer-events-none absolute inset-0 m-auto h-[160vmax] w-[160vmax] scale-0 rounded-full opacity-0"
        style={{
          background:
            'radial-gradient(circle, #ffffff 0%, #ffffff 26%, rgba(169,200,255,0.55) 52%, rgba(169,200,255,0) 72%)',
        }}
      />
    </div>
  )
}
