import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/** Exported so tests can drive the animation loop to a specific orbital
 * phase without duplicating this constant. */
export const PERIOD_MS = 11000
/** Resolution of the phase-folded light curve — a fixed number of points
 * across one whole orbit, not a rolling per-frame buffer. Independent of
 * frame rate by construction: nothing here is scaled by 60fps or any dt. */
const CURVE_SAMPLES = 200
const STAR_COLOR = '#a9c8ff'
/** Planet rotation period. Deliberately not a divisor of PERIOD_MS, so the
 *  banding never looks frozen relative to the transit. */
const SPIN_MS = 4200
/** Fixed spin for the reduced-motion frame, so that render stays deterministic
 *  for the visual-regression baseline. */
const STATIC_SPIN = 1.1
/** Fixed instant for the reduced-motion frame. The window spans 1.6 periods
 *  ending here, so a transit centred at 0.5 * PERIOD_MS lands well inside the
 *  chart rather than clipped at an edge — and the render stays deterministic
 *  for the visual-regression baseline. */
const STATIC_NOW_MS = PERIOD_MS * 1.1
/** Vertical semi-axis of the orbit ellipse, as a fraction of starR. Small
 * enough that the transiting body (bodyR = 0.28 * starR) still overlaps the
 * disc at inferior conjunction (bodyR + this < starR), but large enough that
 * the ellipse reads as tilted-into-the-screen rather than a flat line. */
const VERT_EXTENT_RATIO = 0.35

/**
 * Normalised flux, 1 = unobscured. Linear ramp through ingress/egress.
 * `front` gates the whole effect: a body behind the star (the back half of
 * its orbit) cannot block the star's light no matter how close it appears
 * in projection, so front=false always returns 1. Defaults to true so
 * existing callers/tests that only care about the horizontal geometry (and
 * predate the orbit) are unaffected.
 * Exported (pure, no closures) so the dip-synchronisation maths can be
 * tested directly rather than through pixel output.
 */
export function fluxAt(
  bodyX: number,
  starX: number,
  starR: number,
  bodyR: number,
  front = true,
): number {
  if (!front) return 1
  const d = Math.abs(bodyX - starX)
  const depth = (bodyR * bodyR) / (starR * starR)
  if (d >= starR + bodyR) return 1
  if (d <= starR - bodyR) return 1 - depth
  const t = (starR + bodyR - d) / (2 * bodyR)
  // Smoothstep rather than a linear ramp. A straight ramp produces a
  // trapezoid with mitred corners; real ingress and egress are gradual as the
  // body's disc crosses the limb, and the eased curve reads as light rather
  // than as a chart. Monotone with the same endpoints, so every existing
  // assertion about ramp direction and boundary continuity still holds — and
  // at the ramp's midpoint smoothstep(0.5) is exactly 0.5, so mid-ingress
  // flux remains precisely 1 - depth/2.
  const eased = t * t * (3 - 2 * t)
  return 1 - depth * eased
}

/**
 * The orbit: a circle of radius `travel / 2` seen nearly edge-on. `angle`
 * is offset by pi/2 so that phase 0 lands the body directly behind the star
 * (occultation, centred) and phase 0.5 lands it directly in front (transit,
 * centred) — the two points where horizontal distance to the star is zero.
 * Between those, the body sweeps through the left/right extremes, so one
 * full lap reads as: behind -> left -> in front (transiting) -> right ->
 * behind again, continuously, with no reset.
 */
function orbitAngle(phase: number): number {
  return phase * Math.PI * 2 + Math.PI / 2
}

/** Line-of-sight sign: positive = in front of the star (toward the
 * viewer), negative = behind it. Zero only at the far left/right of the
 * orbit, where the body is nowhere near the star and draw order is moot. */
function orbitZAt(phase: number): number {
  return -Math.sin(orbitAngle(phase))
}

function isFrontPass(phase: number): boolean {
  return orbitZAt(phase) >= 0
}

/**
 * Flux at a given orbital phase — composes the orbit geometry above with
 * `fluxAt`, gating the dip to the front pass. This is the single function
 * that answers "does the light curve dip here", used both to build the
 * phase-folded curve and to test the core physics directly.
 */
export function fluxAtPhase(
  phase: number,
  starX: number,
  starR: number,
  bodyR: number,
  travel: number,
): number {
  const angle = orbitAngle(phase)
  const bodyX = starX + (travel / 2) * Math.cos(angle)
  return fluxAt(bodyX, starX, starR, bodyR, isFrontPass(phase))
}

/**
 * Stellar variability, as a pure function of absolute time.
 *
 * A real photometric series is never a flat line: the star flickers, the
 * detector adds noise, and the transit has to be picked out from inside that.
 * Four incommensurate sines sum to something that never visibly repeats and
 * stays within [-1, 1] (the amplitudes total 1). Callers scale it by a
 * fraction of the transit depth, so the dip stays several times larger than
 * the wobble and remains the obvious feature.
 *
 * Being a function of time rather than of frame index is what makes the trace
 * frame-rate independent and lets it scroll: the same instant always yields
 * the same value, whatever the refresh rate.
 */
export function photometricNoise(timeMs: number): number {
  const t = timeMs / 1000
  return (
    Math.sin(t * 1.7) * 0.5 +
    Math.sin(t * 3.9 + 1.3) * 0.3 +
    Math.sin(t * 8.3 + 2.7) * 0.15 +
    Math.sin(t * 17.1 + 0.6) * 0.05
  )
}

/** Noise amplitude as a fraction of the transit depth. Large enough that the
 *  line always looks alive, small enough that the dip dominates it. */
const NOISE_FRACTION = 0.17

/** How much history the strip chart shows. Wider than one period, so a dip is
 *  essentially always somewhere on screen and the repetition is legible. */
const WINDOW_MS = PERIOD_MS * 1.6

/**
 * Flux at an absolute instant: the geometric transit signal plus variability.
 * Kept separate from `fluxAtPhase` so the physics stays independently testable
 * without noise in the way.
 */
export function fluxAtTime(
  timeMs: number,
  starX: number,
  starR: number,
  bodyR: number,
  travel: number,
): number {
  const phase = ((timeMs % PERIOD_MS) + PERIOD_MS) / PERIOD_MS % 1
  const depth = (bodyR * bodyR) / (starR * starR)
  return (
    fluxAtPhase(phase, starX, starR, bodyR, travel) +
    photometricNoise(timeMs) * depth * NOISE_FRACTION
  )
}

export function Transit() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = canvas.clientWidth || 320
    let height = canvas.clientHeight || 260
    let starR = 0
    let bodyR = 0
    let starX = 0
    let starY = 0
    let travel = 0
    let vertExtent = 0
    let starGradient: CanvasGradient | null = null
    let orbitPathPoints: { x: number; y: number }[] = []

    function bodyXAt(phase: number): number {
      return starX + (travel / 2) * Math.cos(orbitAngle(phase))
    }

    function bodyYAt(phase: number): number {
      return starY + vertExtent * Math.sin(orbitAngle(phase))
    }

    function buildFluxCurve(nowMs: number): number[] {
      // Samples run oldest (left) to newest (right) across WINDOW_MS ending at
      // `nowMs`, so as `nowMs` advances the whole trace slides leftward and new
      // measurements arrive at the right edge — a strip chart, not a static
      // folded curve.
      return Array.from({ length: CURVE_SAMPLES }, (_, i) => {
        const age = WINDOW_MS * (1 - i / (CURVE_SAMPLES - 1))
        return fluxAtTime(nowMs - age, starX, starR, bodyR, travel)
      })
    }

    function buildOrbitPath() {
      const segments = 64
      orbitPathPoints = Array.from({ length: segments + 1 }, (_, i) => {
        const phase = i / segments
        return { x: bodyXAt(phase), y: bodyYAt(phase) }
      })
    }

    function measure() {
      width = canvas!.clientWidth || 320
      height = canvas!.clientHeight || 260
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      starR = Math.min(width, height) * 0.11
      bodyR = starR * 0.28
      starX = width * 0.5
      starY = height * 0.3
      travel = width * 0.92
      vertExtent = starR * VERT_EXTENT_RATIO
      // Rebuilt only here (on mount/resize), never per frame: the gradient
      // and the two geometry caches below all depend solely on layout.
      starGradient = ctx!.createRadialGradient(
        starX,
        starY,
        0,
        starX,
        starY,
        starR * 2.6,
      )
      starGradient.addColorStop(0, '#ffffff')
      starGradient.addColorStop(0.32, STAR_COLOR)
      starGradient.addColorStop(1, 'rgba(169, 200, 255, 0)')
      buildOrbitPath()
      // NOT cached here any more: the trace depends on the instant being drawn,
      // so it is rebuilt per frame. 200 samples of arithmetic is nothing next
      // to the 5,000-point starfield already running.
    }

    function drawStar() {
      ctx!.fillStyle = starGradient!
      ctx!.beginPath()
      ctx!.arc(starX, starY, starR * 2.6, 0, Math.PI * 2)
      ctx!.fill()

      ctx!.fillStyle = '#ffffff'
      ctx!.beginPath()
      ctx!.arc(starX, starY, starR, 0, Math.PI * 2)
      ctx!.fill()
    }

    function drawOrbitPath() {
      ctx!.strokeStyle = 'rgba(169, 200, 255, 0.16)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      orbitPathPoints.forEach((p, i) => {
        if (i === 0) ctx!.moveTo(p.x, p.y)
        else ctx!.lineTo(p.x, p.y)
      })
      ctx!.stroke()
    }

    /**
     * Banded gas giant rather than a flat silhouette.
     *
     * It was previously filled with the page background colour, which meant it
     * vanished against the backdrop on the half of the orbit where it is not
     * crossing the star. The body has to read in two very different contexts —
     * silhouetted against a white stellar disc on the front pass, and against a
     * near-black sky either side of it — so it needs both dark and light tones
     * rather than one. Alternating near-black and pale blue bands give it
     * contrast in both.
     *
     * `spin` drifts the bands sideways so the planet reads as rotating; the
     * bands are sine-warped rather than straight so they read as flow rather
     * than stripes.
     */
    function drawBody(bodyX: number, bodyY: number, spin: number) {
      const r = bodyR
      ctx!.save()

      // Clip everything that follows to the planet's disc.
      ctx!.beginPath()
      ctx!.arc(bodyX, bodyY, r, 0, Math.PI * 2)
      ctx!.clip()

      // Base: deep navy, not pure black, so it never matches the backdrop.
      ctx!.fillStyle = '#0c1424'
      ctx!.fillRect(bodyX - r, bodyY - r, r * 2, r * 2)

      // Latitude bands, widest at the equator. Values run dark -> pale so the
      // planet has internal contrast at any size.
      const bands: Array<{ from: number; to: number; fill: string }> = [
        { from: -1.0, to: -0.66, fill: '#0a1120' },
        { from: -0.66, to: -0.3, fill: '#22456e' },
        { from: -0.3, to: -0.08, fill: '#8fbde9' },
        { from: -0.08, to: 0.16, fill: '#0a1120' },
        { from: 0.16, to: 0.46, fill: '#5b93c9' },
        { from: 0.46, to: 0.72, fill: '#16294a' },
        { from: 0.72, to: 1.0, fill: '#7fb2e8' },
      ]

      const STEPS = 14
      for (const band of bands) {
        ctx!.fillStyle = band.fill
        ctx!.beginPath()
        for (let i = 0; i <= STEPS; i += 1) {
          const t = i / STEPS
          const x = bodyX - r + t * r * 2
          // Warp each edge with a slow sine so bands curve like flow lines.
          const warp = Math.sin(t * Math.PI * 2 + spin + band.from * 3) * r * 0.07
          const y = bodyY + band.from * r + warp
          if (i === 0) ctx!.moveTo(x, y)
          else ctx!.lineTo(x, y)
        }
        for (let i = STEPS; i >= 0; i -= 1) {
          const t = i / STEPS
          const x = bodyX - r + t * r * 2
          const warp = Math.sin(t * Math.PI * 2 + spin + band.to * 3) * r * 0.07
          ctx!.lineTo(x, bodyY + band.to * r + warp)
        }
        ctx!.closePath()
        ctx!.fill()
      }

      // A single darker oval standing in for a storm, drifting with the bands.
      const stormX = bodyX + Math.cos(spin * 0.6) * r * 0.35
      ctx!.fillStyle = 'rgba(6, 10, 20, 0.75)'
      ctx!.beginPath()
      ctx!.ellipse(stormX, bodyY + r * 0.3, r * 0.26, r * 0.15, 0, 0, Math.PI * 2)
      ctx!.fill()

      // Limb darkening, so it reads as a sphere and not a disc.
      const limb = ctx!.createRadialGradient(
        bodyX - r * 0.25,
        bodyY - r * 0.25,
        r * 0.1,
        bodyX,
        bodyY,
        r,
      )
      limb.addColorStop(0, 'rgba(255, 255, 255, 0.16)')
      limb.addColorStop(0.6, 'rgba(0, 0, 0, 0)')
      limb.addColorStop(1, 'rgba(0, 0, 0, 0.55)')
      ctx!.fillStyle = limb
      ctx!.fillRect(bodyX - r, bodyY - r, r * 2, r * 2)

      ctx!.restore()

      // Rim, kept faint — it is what separates the planet from the white disc
      // when it is mid-transit.
      ctx!.strokeStyle = 'rgba(169, 200, 255, 0.5)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.arc(bodyX, bodyY, r, 0, Math.PI * 2)
      ctx!.stroke()
    }

    function drawCurve(flux: number[]) {
      const top = height * 0.6
      const bottom = height * 0.95
      const left = width * 0.04
      const right = width * 0.96
      const depth = (bodyR * bodyR) / (starR * starR)
      const noiseAmp = depth * NOISE_FRACTION

      // Vertical mapping has to leave room for the variability to sit above the
      // unobscured baseline as well as below it, or the wobble clips flat
      // against the top of the band and stops reading as noise.
      const hi = 1 + noiseAmp * 1.8
      const lo = 1 - depth - noiseAmp * 1.8
      const scale = (f: number) => bottom - ((f - lo) / (hi - lo)) * (bottom - top)

      // Baseline at unobscured flux, so the dip is measured against something.
      ctx!.strokeStyle = 'rgba(169, 200, 255, 0.14)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(left, scale(1))
      ctx!.lineTo(right, scale(1))
      ctx!.stroke()

      const n = flux.length
      const xAt = (i: number) => left + ((right - left) * i) / (n - 1)

      // Midpoint-quadratic smoothing. Even with 200 samples a polyline shows
      // visible corners where the gradient turns sharply; routing each segment
      // through a quadratic anchored on the sample and ending at the midpoint
      // of the next gives a continuously curving line with no mitred joints.
      ctx!.strokeStyle = STAR_COLOR
      ctx!.lineWidth = 1.5
      ctx!.lineJoin = 'round'
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(xAt(0), scale(flux[0]))
      for (let i = 1; i < n - 1; i += 1) {
        const cx = xAt(i)
        const cy = scale(flux[i])
        const mx = (cx + xAt(i + 1)) / 2
        const my = (cy + scale(flux[i + 1])) / 2
        ctx!.quadraticCurveTo(cx, cy, mx, my)
      }
      ctx!.quadraticCurveTo(
        xAt(n - 2),
        scale(flux[n - 2]),
        xAt(n - 1),
        scale(flux[n - 1]),
      )
      ctx!.stroke()

      // The newest measurement, at the leading edge — the point the trace is
      // scrolling away from.
      ctx!.fillStyle = '#ffffff'
      ctx!.beginPath()
      ctx!.arc(xAt(n - 1), scale(flux[n - 1]), 2.2, 0, Math.PI * 2)
      ctx!.fill()
    }

    function frame(
      flux: number[],
      bodyX: number,
      bodyY: number,
      front: boolean,
      spin: number,
    ) {
      ctx!.clearRect(0, 0, width, height)
      drawOrbitPath()
      // Draw order encodes depth: in front of the star, the body is nearer
      // the viewer and must be painted after (on top of) it; behind the
      // star, the star occludes the body and must be painted after it.
      if (front) {
        drawStar()
        drawBody(bodyX, bodyY, spin)
      } else {
        drawBody(bodyX, bodyY, spin)
        drawStar()
      }
      drawCurve(flux)
    }

    measure()

    if (reduced) {
      // Mid-ingress on the front pass: the body's centre exactly starR from
      // the star's centre (the midpoint of the ramp), arriving from the
      // left. Solved from the orbit geometry (cos(angle) = -starR / (travel
      // / 2)) rather than reusing the old linear-travel constant, so it
      // stays correct for the elliptical model at any aspect ratio. Since
      // starR = min(w,h)*0.11 and travel = w*0.92, the asin argument is
      // bounded by ~0.24 for any width/height, well inside its domain.
      const midIngressPhase =
        0.5 - Math.asin((2 * starR) / travel) / (2 * Math.PI)
      const bodyX = bodyXAt(midIngressPhase)
      const bodyY = bodyYAt(midIngressPhase)
      const front = isFrontPass(midIngressPhase)
      frame(buildFluxCurve(STATIC_NOW_MS), bodyX, bodyY, front, STATIC_SPIN)
      const onResize = () => {
        measure()
        const nextPhase =
          0.5 - Math.asin((2 * starR) / travel) / (2 * Math.PI)
        const nextX = bodyXAt(nextPhase)
        const nextY = bodyYAt(nextPhase)
        const nextFront = isFrontPass(nextPhase)
        frame(buildFluxCurve(STATIC_NOW_MS), nextX, nextY, nextFront, STATIC_SPIN)
      }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    let raf = 0
    let start = -1

    function tick(now: number) {
      if (start < 0) start = now
      const elapsed = now - start
      const phase = (elapsed % PERIOD_MS) / PERIOD_MS
      const bodyX = bodyXAt(phase)
      const bodyY = bodyYAt(phase)
      const front = isFrontPass(phase)
      frame(
        buildFluxCurve(elapsed),
        bodyX,
        bodyY,
        front,
        (elapsed / SPIN_MS) * Math.PI * 2,
      )
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [reduced])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-[260px] w-full sm:h-[300px]"
    />
  )
}
