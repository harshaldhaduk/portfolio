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
export const SPIN_MS = 4200
/** Fixed instant for the reduced-motion frame. The window spans 1.6 periods
 *  ending here, so a transit centred at 0.5 * PERIOD_MS lands well inside the
 *  chart rather than clipped at an edge — and the render stays deterministic
 *  for the visual-regression baseline. */
const STATIC_NOW_MS = PERIOD_MS * 1.1

/**
 * Scene geometry, in the 3D scene's own units.
 *
 * These live here rather than in `OrbitScene` because the light curve and the
 * orbit have to agree about them exactly — the curve's transit depth is
 * `(planetRadius / starRadius)^2` and its dip only exists while the planet's
 * projected separation falls under `starRadius + planetRadius`. Two copies of
 * these numbers would let the chart claim a transit the visible orbit is not
 * performing. `OrbitScene` imports them, so there is one source of truth and
 * the dependency runs in one direction.
 */
export const ORBIT_RADIUS = 3.2
export const STAR_RADIUS = 0.62
export const PLANET_RADIUS = STAR_RADIUS * 0.28

/**
 * Camera elevation above the orbital plane, in radians, at rest.
 *
 * Deliberately tiny. The orbit has to sit close enough to edge-on that the
 * planet still crosses the stellar disc — the transit only exists while
 * `ORBIT_RADIUS * sin(elevation) < STAR_RADIUS + PLANET_RADIUS` — and this is
 * also the angle the flat 2D version of this graphic was drawn at, so the
 * resting pose matches what the page looked like before it became
 * interactive. It is not zero because a perfectly edge-on circle projects to
 * a bare line, which reads as a mistake rather than as an orbit.
 *
 * Lives here rather than with the scene that uses it so that `Hero` can seed
 * its elevation ref, and the tests can assert the resting angle still
 * transits, without either of them importing three.js.
 */
export const REST_ELEVATION = 0.1

/**
 * Where the camera is looking from, in the orbit's own frame: `azimuth` is its
 * bearing around the orbit, `elevation` its height above the orbital plane.
 * Owned by the 3D scene and read by the light curve, which needs both — see
 * {@link projectedSeparation}.
 */
export type OrbitView = { elevation: number; azimuth: number }

export const REST_VIEW: OrbitView = { elevation: REST_ELEVATION, azimuth: 0 }

/**
 * Normalised flux, 1 = unobscured, from the planet's projected separation
 * from the star's centre. Smoothstep ramp through ingress/egress.
 *
 * `front` gates the whole effect: a body behind the star (the back half of
 * its orbit) cannot block the star's light no matter how close it appears in
 * projection, so front=false always returns 1.
 *
 * Taking a separation rather than a pair of x coordinates is what lets the
 * same function serve the tilted case: once the orbit can be viewed from
 * above, the planet misses the disc vertically as well as horizontally, and
 * only the true 2D separation decides whether any light is blocked.
 */
export function fluxAtSeparation(
  d: number,
  starR: number,
  bodyR: number,
  front = true,
): number {
  if (!front) return 1
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
 * Normalised flux for a body at `bodyX` against a star at `starX`, i.e. the
 * purely horizontal (perfectly edge-on) case. Retained as the edge-on
 * specialisation of {@link fluxAtSeparation}.
 */
export function fluxAt(
  bodyX: number,
  starX: number,
  starR: number,
  bodyR: number,
  front = true,
): number {
  return fluxAtSeparation(Math.abs(bodyX - starX), starR, bodyR, front)
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
export function orbitAngle(phase: number): number {
  return phase * Math.PI * 2 + Math.PI / 2
}

/**
 * Line-of-sight sign: positive = between the camera and the star, negative =
 * behind it.
 *
 * Generalised over `azimuth`, the camera's bearing around the orbit. Swinging
 * the camera horizontally changes *which* stretch of the orbit is nearest to
 * it, and therefore at what phase the planet passes in front — so conjunction
 * is not pinned to one moment in the period, it slides as you orbit the
 * camera. Elevation cannot flip this sign (it only scales the whole thing by
 * cos(elevation), positive throughout the usable range), which is why only
 * azimuth appears here.
 *
 * At azimuth 0 this is exactly -sin(theta), the original head-on case.
 */
function orbitZAt(phase: number, azimuth = 0): number {
  return Math.sin(azimuth - orbitAngle(phase))
}

function isFrontPass(phase: number, azimuth = 0): boolean {
  return orbitZAt(phase, azimuth) >= 0
}

/**
 * How far the planet appears from the star's centre, as seen from
 * `elevation` radians above the orbital plane.
 *
 * Edge-on (elevation 0) the orbit collapses to a horizontal line and the
 * separation is purely the horizontal one, reproducing the flat case exactly.
 * As the camera climbs, the orbit's near/far extent starts projecting into
 * vertical screen offset — scaled by sin(elevation) — so at conjunction the
 * planet rides above or below the disc instead of across it. That is the
 * whole reason the dip fades out as you rotate the scene: past
 * `asin((starR + bodyR) / a)` the planet simply never touches the disc.
 */
export function projectedSeparation(
  phase: number,
  a: number,
  elevation: number,
  azimuth = 0,
): number {
  // The planet's distance from the view axis: |P|^2 - (P . viewDir)^2 for a
  // point on a circle of radius `a`, seen from (azimuth, elevation). The dot
  // product collapses to a*cos(elevation)*sin(azimuth - theta), leaving
  // a^2 * (1 - cos^2(elevation) * sin^2(azimuth - theta)).
  //
  // Both angles matter and they do different jobs: azimuth decides *when* the
  // planet lines up with the star, elevation decides *how close* it gets when
  // it does. Dropping either one pins the transit to a single fixed viewpoint.
  const s = Math.sin(azimuth - orbitAngle(phase))
  const c = Math.cos(elevation)
  return a * Math.sqrt(Math.max(0, 1 - c * c * s * s))
}

/**
 * Flux at a given orbital phase — composes the orbit geometry above with
 * {@link fluxAtSeparation}, gating the dip to the front pass. This is the
 * single function that answers "does the light curve dip here", used both to
 * build the phase-folded curve and to test the core physics directly.
 *
 * `elevation` defaults to 0 (perfectly edge-on), so callers written against
 * the flat version are unaffected.
 */
export function fluxAtPhase(
  phase: number,
  // Unused since the separation is computed from the orbit's own radius
  // rather than from screen coordinates, but kept in place so the positional
  // signature every existing caller and test uses still resolves.
  _starX: number,
  starR: number,
  bodyR: number,
  travel: number,
  elevation = 0,
  azimuth = 0,
): number {
  const d = projectedSeparation(phase, travel / 2, elevation, azimuth)
  return fluxAtSeparation(d, starR, bodyR, isFrontPass(phase, azimuth))
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
  elevation = 0,
  azimuth = 0,
): number {
  const phase = ((timeMs % PERIOD_MS) + PERIOD_MS) / PERIOD_MS % 1
  const depth = (bodyR * bodyR) / (starR * starR)
  return (
    fluxAtPhase(phase, starX, starR, bodyR, travel, elevation, azimuth) +
    photometricNoise(timeMs) * depth * NOISE_FRACTION
  )
}

/**
 * The photometric trace under the orbit: a strip chart of the star's
 * brightness, scrolling right to left, dipping each time the planet crosses
 * the disc.
 *
 * Reads `viewRef` fresh on every frame rather than taking the angle as a
 * prop. The orbit scene above publishes the viewing elevation there while the
 * visitor drags, and threading that through React state would re-render the
 * hero on every frame of a drag to move a single number. The visible payoff is
 * that rotating the orbit away from edge-on visibly flattens the dip here,
 * because past a certain angle the planet genuinely stops occulting the star.
 */
export function Transit({
  viewRef,
}: {
  viewRef?: React.RefObject<OrbitView>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = canvas.clientWidth || 320
    let height = canvas.clientHeight || 110

    // Scene units, not pixels: the curve describes the same system the 3D
    // orbit is drawing, so it uses that system's geometry directly and is
    // independent of how large this canvas happens to be.
    const starR = STAR_RADIUS
    const bodyR = PLANET_RADIUS
    const travel = ORBIT_RADIUS * 2

    function currentView(): OrbitView {
      return viewRef?.current ?? { elevation: 0, azimuth: 0 }
    }

    /**
     * The trace is *recorded*, not recomputed.
     *
     * Each slot is written once, using the viewing angle that was current at
     * that instant, and is never revisited. Rebuilding the whole window from
     * the current angle every frame — the obvious implementation, and the one
     * this replaced — meant rotating the orbit retroactively rewrote the
     * measurements to the left of the leading edge, as though the observatory
     * had always been pointed the new way. A strip chart of past observations
     * cannot do that: turning the telescope now can only affect what arrives
     * from now on.
     *
     * A ring buffer rather than a shifting array, so advancing one slot is a
     * single write and an index bump instead of moving 200 elements.
     */
    const slotMs = WINDOW_MS / (CURVE_SAMPLES - 1)
    const samples = new Array<number>(CURVE_SAMPLES).fill(1)
    let oldest = 0
    let nextSampleAt = 0

    function record(atMs: number, view: OrbitView): number {
      return fluxAtTime(atMs, 0, starR, bodyR, travel, view.elevation, view.azimuth)
    }

    function seed(nowMs: number, view: OrbitView) {
      for (let i = 0; i < CURVE_SAMPLES; i += 1) {
        samples[i] = record(nowMs - WINDOW_MS + i * slotMs, view)
      }
      oldest = 0
      nextSampleAt = nowMs + slotMs
    }

    function advance(nowMs: number, view: OrbitView) {
      // A backgrounded tab resumes with an arbitrary amount of unrecorded
      // time; reseed rather than grinding out every skipped slot one by one.
      if (nowMs - nextSampleAt > WINDOW_MS) {
        seed(nowMs, view)
        return
      }
      while (nextSampleAt <= nowMs) {
        samples[oldest] = record(nextSampleAt, view)
        oldest = (oldest + 1) % CURVE_SAMPLES
        nextSampleAt += slotMs
      }
    }

    /** Ring buffer unrolled oldest-first, which is left-to-right on screen. */
    /**
     * Reads the ring buffer oldest-first (left-to-right on screen) without
     * unrolling it into a new array. The previous version allocated a
     * 200-element array on every single frame purely to be read once and
     * thrown away, which is pure garbage-collector pressure for a canvas that
     * redraws sixty times a second.
     */
    function sampleAt(i: number): number {
      return samples[(oldest + i) % CURVE_SAMPLES]
    }

    function measure() {
      width = canvas!.clientWidth || 320
      height = canvas!.clientHeight || 110
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    /**
     * @param frac How far the clock has travelled toward the next sample, 0-1.
     *
     * This is what keeps the trace scrolling smoothly. A new measurement only
     * lands every `slotMs` — about 88ms, or roughly eleven times a second — so
     * drawing the samples at fixed positions makes the whole trace sit still
     * and then jump a couple of pixels, eleven times a second. That reads as
     * stutter even though nothing is dropping frames. Sliding the plot left by
     * the fraction of a slot already elapsed spreads that jump across every
     * frame in between, so the trace creeps continuously at whatever rate the
     * display refreshes, without sampling the physics any more often.
     */
    function drawCurve(frac: number) {
      const top = height * 0.14
      const bottom = height * 0.9
      const left = width * 0.04
      const right = width * 0.96
      const depth = (bodyR * bodyR) / (starR * starR)
      const noiseAmp = depth * NOISE_FRACTION

      // Vertical mapping has to leave room for the variability to sit above the
      // unobscured baseline as well as below it, or the wobble clips flat
      // against the top of the band and stops reading as noise. Fixed to the
      // full-depth range rather than the current dip, so the trace does not
      // rescale itself as the visitor rotates the orbit — the dip has to be
      // seen to shrink, which it cannot do if the axis shrinks with it.
      const hi = 1 + noiseAmp * 1.8
      const lo = 1 - depth - noiseAmp * 1.8
      const scale = (f: number) => bottom - ((f - lo) / (hi - lo)) * (bottom - top)

      ctx!.clearRect(0, 0, width, height)

      // Baseline at unobscured flux, so the dip is measured against something.
      ctx!.strokeStyle = 'rgba(169, 200, 255, 0.14)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.moveTo(left, scale(1))
      ctx!.lineTo(right, scale(1))
      ctx!.stroke()

      const n = CURVE_SAMPLES
      const step = (right - left) / (n - 1)
      // The whole plot is offset by the sub-slot fraction; the oldest sample
      // slides off the left edge as the newest arrives at the right.
      const xAt = (i: number) => left + (i - frac) * step

      // Midpoint-quadratic smoothing. Even with 200 samples a polyline shows
      // visible corners where the gradient turns sharply; routing each segment
      // through a quadratic anchored on the sample and ending at the midpoint
      // of the next gives a continuously curving line with no mitred joints.
      ctx!.strokeStyle = STAR_COLOR
      ctx!.lineWidth = 1.5
      ctx!.lineJoin = 'round'
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(xAt(0), scale(sampleAt(0)))
      for (let i = 1; i < n - 1; i += 1) {
        const cx = xAt(i)
        const cy = scale(sampleAt(i))
        const mx = (cx + xAt(i + 1)) / 2
        const my = (cy + scale(sampleAt(i + 1))) / 2
        ctx!.quadraticCurveTo(cx, cy, mx, my)
      }
      ctx!.quadraticCurveTo(
        xAt(n - 2),
        scale(sampleAt(n - 2)),
        xAt(n - 1),
        scale(sampleAt(n - 1)),
      )
      ctx!.stroke()

      // The newest measurement, at the leading edge — the point the trace is
      // scrolling away from.
      ctx!.fillStyle = '#ffffff'
      ctx!.beginPath()
      ctx!.arc(xAt(n - 1), scale(sampleAt(n - 1)), 2.2, 0, Math.PI * 2)
      ctx!.fill()
    }

    measure()

    if (reduced) {
      seed(STATIC_NOW_MS, currentView())
      drawCurve(0)
      const onResize = () => {
        measure()
        seed(STATIC_NOW_MS, currentView())
        drawCurve(0)
      }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    let raf = 0
    let seeded = false

    // `now` is used raw rather than as an offset from this component's own
    // first frame. Both this and the 3D orbit derive orbital phase from the
    // same rAF clock, so using each one's local start time put them on
    // different origins — the dip in the trace led the planet's actual
    // crossing by however long the (lazily loaded) scene took to mount.
    function tick(now: number) {
      const view = currentView()
      if (!seeded) {
        seed(now, view)
        seeded = true
      }
      advance(now, view)
      // How far into the current slot we are. `advance` leaves nextSampleAt
      // strictly ahead of now, so this stays within [0, 1).
      const frac = 1 - (nextSampleAt - now) / slotMs
      drawCurve(frac < 0 ? 0 : frac > 1 ? 1 : frac)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [reduced, viewRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-[86px] w-full sm:h-[100px]"
    />
  )
}
