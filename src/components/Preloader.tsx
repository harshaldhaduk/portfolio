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
 * Builds the detonation renderer for a canvas, returning a draw function that
 * takes progress 0-1.
 *
 * Drawn rather than composed from CSS gradients because a scaled radial
 * gradient always reads as exactly what it is — a circle with a visible
 * boundary, however soft the falloff. What sells an explosion is the absence
 * of a clean edge, so the silhouette here is broken up three ways: rays of
 * differing length and width fire past the core, sparks scatter to varying
 * distances, and every element carries its own small start delay so nothing
 * shares a front. The circular core is still present but never gets to be the
 * outline, because faster rays and sparks are always outside it.
 *
 * `lighter` compositing is what makes overlaps bloom instead of flatly
 * stacking — where rays cross they sum toward white, which is how real
 * over-exposed light behaves and is most of why this reads as hot rather than
 * as painted shapes.
 */
function createBurst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth || window.innerWidth
  const h = canvas.clientHeight || window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const cx = w / 2
  const cy = h / 2
  // Reach the corners, so nothing ends mid-screen with a visible frontier.
  const maxR = Math.hypot(w, h) / 2

  // Rays are seeded on an even angular base with jitter, rather than fully at
  // random: pure randomness clumps, leaving bald patches that read as a gap in
  // the explosion rather than as texture.
  const rays = Array.from({ length: 34 }, (_, i) => ({
    angle: (i / 34) * Math.PI * 2 + (Math.random() - 0.5) * 0.22,
    reach: 0.45 + Math.random() * 0.9,
    width: 1 + Math.random() * 3.5,
    delay: Math.random() * 0.14,
  }))

  const sparks = Array.from({ length: 130 }, () => ({
    angle: Math.random() * Math.PI * 2,
    reach: 0.28 + Math.random() * 1.0,
    size: 0.6 + Math.random() * 1.9,
    delay: Math.random() * 0.18,
  }))

  /** Progress for an element that starts late, renormalised to its own 0-1. */
  const staggered = (t: number, delay: number) =>
    delay >= 1 ? 0 : Math.max(0, (t - delay) / (1 - delay))

  return (t: number) => {
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'

    // Core. Fades faster than it grows so it is spent by the time the rays
    // are at full extension — a core that outlives them looks like a balloon.
    const coreT = 1 - Math.pow(1 - t, 3)
    const coreR = maxR * coreT * 0.52
    const coreA = Math.max(0, 1 - t * 1.15)
    if (coreR > 0 && coreA > 0) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      g.addColorStop(0, `rgba(255,255,255,${coreA})`)
      g.addColorStop(0.32, `rgba(216,233,255,${coreA * 0.5})`)
      g.addColorStop(1, 'rgba(169,200,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const ray of rays) {
      const rt = staggered(t, ray.delay)
      if (rt <= 0) continue
      const ease = 1 - Math.pow(1 - rt, 4)
      const inner = maxR * ease * 0.1
      const outer = maxR * ease * ray.reach
      const alpha = Math.max(0, 1 - rt * 1.25)
      if (alpha <= 0) continue
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`
      ctx.lineWidth = Math.max(0.4, ray.width * (1 - rt * 0.7))
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ray.angle) * inner, cy + Math.sin(ray.angle) * inner)
      ctx.lineTo(cx + Math.cos(ray.angle) * outer, cy + Math.sin(ray.angle) * outer)
      ctx.stroke()
    }

    for (const spark of sparks) {
      const st = staggered(t, spark.delay)
      if (st <= 0) continue
      const ease = 1 - Math.pow(1 - st, 3)
      const dist = maxR * ease * spark.reach
      const alpha = Math.max(0, 1 - st * 1.1)
      if (alpha <= 0) continue
      ctx.fillStyle = `rgba(228,241,255,${alpha})`
      ctx.beginPath()
      ctx.arc(
        cx + Math.cos(spark.angle) * dist,
        cy + Math.sin(spark.angle) * dist,
        Math.max(0.3, spark.size * (1 - st * 0.5)),
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }

    // There is deliberately no stroked shockwave ring. One was tried and it
    // was the single worst thing on screen: a crisp arc is unambiguously a
    // circle, so it re-introduced exactly the hard geometric edge this whole
    // renderer exists to avoid, and being the only continuous line it drew the
    // eye straight to it. The expanding front is instead implied by the rays
    // and sparks arriving at different radii, which leaves no traceable
    // outline anywhere in the frame.
    ctx.globalCompositeOperation = 'source-over'
  }
}

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
      const burstCanvas = el.querySelector<HTMLCanvasElement>('[data-preloader-burst]')
      const digits = el.querySelector<HTMLElement>('[data-preloader-digits]')
      const drawBurst = burstCanvas ? createBurst(burstCanvas) : null

      tl = gsap.timeline({ onComplete: finish })

      if (bar && fill && digits && drawBurst) {
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
          // The burst is one tween of plain progress; every layer's shape,
          // timing and falloff lives in the renderer rather than being split
          // across competing tweens on separate DOM nodes.
          .to(
            { p: 0 },
            {
              p: 1,
              duration: 0.72,
              ease: 'none',
              onUpdate() {
                drawBurst(this.targets()[0].p as number)
              },
            },
            '>-0.04',
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
      {/* Full-bleed so rays and sparks can run off every edge instead of
          stopping at a box boundary. */}
      <canvas
        data-preloader-burst
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  )
}
