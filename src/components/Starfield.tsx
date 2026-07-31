import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/**
 * Faithful 2D-canvas port of the `sanidhyy/space-portfolio` rotating star
 * sphere (originally @react-three/drei `<Points>` + `<PointMaterial>`).
 * 5,000 points fill a sphere of radius 1.2; the camera sits at z = 1
 * (inside the sphere) looking toward -z; the cloud spins continuously and
 * carries a static Math.PI/4 tilt about z, matching the reference's
 * `<group rotation={[0, 0, Math.PI / 4]}>` wrapping a `<Points>` whose own
 * rotation.x/y are driven by useFrame.
 */
const STAR_COUNT = 5000
const SPHERE_RADIUS = 1.2

/** Matches @react-three/fiber's default PerspectiveCamera fov (75deg). */
const FOV_RADIANS = (75 * Math.PI) / 180
const FOCAL = 1 / Math.tan(FOV_RADIANS / 2)

/** Static group tilt from the reference: rotation={[0, 0, Math.PI / 4]}. */
const TILT_Z = Math.PI / 4
const COS_TILT_Z = Math.cos(TILT_Z)
const SIN_TILT_Z = Math.sin(TILT_Z)

/** Points this close to (or behind) the camera plane are culled, not drawn. */
const NEAR_EPSILON = 0.02

/** Size/alpha attenuation tuning — clamped so far stars stay visible and
 *  near ones don't become blobs (mirrors PointMaterial's sizeAttenuation).
 *
 *  Sized against the reference rather than by eye. three.js computes
 *  `gl_PointSize = size * pixelRatio * (height / 2) / -z_view`, so its
 *  `size={0.002}` on an 800px-tall canvas gives `0.002 * 400 = 0.8` over
 *  distance. With the camera at z = 1 just inside a radius-1.2 sphere,
 *  distances run roughly 0.8-2.2, putting its points at 0.4-1.0px DIAMETER —
 *  a radius of about 0.2-0.5px. These constants target that, having previously
 *  been ~4x too large. */
const SIZE_K = 0.4
const MIN_RADIUS = 0.16
const MAX_RADIUS = 0.9
/* Tuned against legibility, not just fidelity. With the body background bug
   fixed the field became genuinely visible — and at the original values it
   overwhelmed the text sitting on top of it. axe cannot catch that: it compares
   text against its own background colour, never against a starfield behind it.
   These values keep the depth and the drift readable while leaving the prose
   the brightest thing on the page. */
const ALPHA_K = 0.42
const MIN_ALPHA = 0.04
const MAX_ALPHA = 0.8

/**
 * Intrinsic brightness multiplier applied on top of depth attenuation.
 *
 * Kept narrow on purpose. The reference has NO size variance at all — every
 * point shares one `size` and differs only by distance — so a wide range reads
 * as wrong rather than as richer. This is just enough that stars at equal depth
 * are not identical, with the cubed bias keeping the bright tail rare.
 */
const MAG_MIN = 0.7
const MAG_MAX = 1.7

const TWO_PI = Math.PI * 2

/** Fixed rotation offset for the reduced-motion static frame — chosen away
 *  from (0, 0) so the tilted sphere reads as a real field, not a flat disc. */
const STATIC_ANGLE_X = 0.6
const STATIC_ANGLE_Y = 1.0

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Van der Corput / Halton sequence: deterministic, equidistributed,
 * decorrelated across different `base` values. Using three different bases
 * per point (2, 3, 5 below) avoids the "spiral shell" artifact a single
 * golden-ratio sequence would produce if reused for both angle and radius.
 */
function halton(index: number, base: number): number {
  let result = 0
  let f = 1 / base
  let i = index
  while (i > 0) {
    result += f * (i % base)
    i = Math.floor(i / base)
    f /= base
  }
  return result
}

/**
 * Generates `count` points uniformly through the *volume* of a sphere of
 * `radius`, deterministically (no Math.random, stable across reloads).
 *
 * Direction: base-2 and base-3 Halton values drive z and theta via the
 * standard "pick z uniform in [-1,1], theta uniform in [0,2*pi)" method
 * (Archimedes' hat-box theorem) — this is the correct way to get a uniform
 * distribution *on* the sphere's surface; naive spherical-coordinate
 * sampling clusters points at the poles.
 *
 * Radius: a naive `r = radius * u` clusters points toward the centre,
 * because volume grows with r^2 while a linear r spaces samples evenly.
 * The fix is the inverse-CDF cube-root correction: for a uniform variate
 * `w` in [0,1), `r = radius * cbrt(w)` reproduces P(r < x) = (x/radius)^3,
 * which is exactly the CDF of a uniformly-filled sphere. `w` comes from a
 * base-5 Halton value, independent of the base-2/3 values used for
 * direction, so radius and direction don't correlate index-by-index.
 */
export function generateSpherePoints(count: number, radius: number): Float32Array {
  const points = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const n = i + 1
    const u = halton(n, 2)
    const v = halton(n, 3)
    const w = halton(n, 5)

    const z = 1 - 2 * u
    const theta = TWO_PI * v
    const s = Math.sqrt(Math.max(0, 1 - z * z))
    const r = radius * Math.cbrt(w)

    points[i * 3] = r * s * Math.cos(theta)
    points[i * 3 + 1] = r * s * Math.sin(theta)
    points[i * 3 + 2] = r * z
  }
  return points
}

export type ProjectedStar = {
  visible: boolean
  sx: number
  sy: number
  radius: number
  alpha: number
}

/**
 * Rotates one point (about Y, then X — matching three.js's default Euler
 * composition for a child with only x/y set), applies the static z tilt
 * (the reference's parent `<group>`), then perspective-projects from a
 * camera at z = 1 looking toward -z. Writes into `out` rather than
 * allocating, since this runs for 5,000 points every animation frame.
 *
 * Pure and allocation-free: sin/cos of the rotation angles are computed
 * once per frame by the caller and passed in, not recomputed per point.
 */
/**
 * Per-star intrinsic brightness, so size is not purely a function of depth —
 * without this every star at the same distance is identical and the field
 * reads as uniform noise. Cubing a uniform value biases hard toward the low
 * end, which mimics a real magnitude distribution: mostly faint pinpricks with
 * a scattering of noticeably brighter ones.
 *
 * Deterministic, like the positions, so the sky is stable across reloads.
 */
export function generateMagnitudes(count: number): Float32Array {
  const out = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const u = halton(i + 1, 7)
    out[i] = MAG_MIN + (MAG_MAX - MAG_MIN) * u * u * u
  }
  return out
}

export function projectStar(
  x: number,
  y: number,
  z: number,
  cosX: number,
  sinX: number,
  cosY: number,
  sinY: number,
  halfHeight: number,
  centerX: number,
  centerY: number,
  magnitude: number,
  out: ProjectedStar,
): void {
  // Rotate about Y.
  const x1 = x * cosY + z * sinY
  const z1 = -x * sinY + z * cosY
  // Rotate about X.
  const y2 = y * cosX - z1 * sinX
  const z2 = y * sinX + z1 * cosX
  // Static tilt about Z.
  const x3 = x1 * COS_TILT_Z - y2 * SIN_TILT_Z
  const y3 = x1 * SIN_TILT_Z + y2 * COS_TILT_Z

  const depth = 1 - z2
  if (depth <= NEAR_EPSILON) {
    out.visible = false
    return
  }

  const scale = (FOCAL * halfHeight) / depth
  out.visible = true
  out.sx = centerX + x3 * scale
  out.sy = centerY - y3 * scale
  out.radius = clamp((SIZE_K * magnitude) / depth, MIN_RADIUS, MAX_RADIUS)
  // Brighter stars are also more opaque, not just larger — varying only radius
  // makes them read as blurry blobs rather than brighter points.
  out.alpha = clamp((ALPHA_K * magnitude) / depth, MIN_ALPHA, MAX_ALPHA)
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const points = generateSpherePoints(STAR_COUNT, SPHERE_RADIUS)
    const magnitudes = generateMagnitudes(STAR_COUNT)
    const projected: ProjectedStar = { visible: false, sx: 0, sy: 0, radius: 0, alpha: 0 }
    let width = 0
    let height = 0

    function measure() {
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw(angleX: number, angleY: number) {
      const cosX = Math.cos(angleX)
      const sinX = Math.sin(angleX)
      const cosY = Math.cos(angleY)
      const sinY = Math.sin(angleY)
      const halfHeight = height / 2
      const centerX = width / 2
      const centerY = height / 2

      ctx!.clearRect(0, 0, width, height)
      ctx!.fillStyle = '#ffffff'
      for (let i = 0; i < points.length; i += 3) {
        projectStar(
          points[i],
          points[i + 1],
          points[i + 2],
          cosX,
          sinX,
          cosY,
          sinY,
          halfHeight,
          centerX,
          centerY,
          magnitudes[i / 3],
          projected,
        )
        if (!projected.visible) continue
        ctx!.globalAlpha = projected.alpha
        ctx!.beginPath()
        ctx!.arc(projected.sx, projected.sy, projected.radius, 0, TWO_PI)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    measure()

    if (reduced) {
      draw(STATIC_ANGLE_X, STATIC_ANGLE_Y)
      const onResize = () => {
        measure()
        draw(STATIC_ANGLE_X, STATIC_ANGLE_Y)
      }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    let raf = 0
    let start = 0
    function tick(now: number) {
      if (!start) start = now
      const t = (now - start) / 1000
      // Matches the reference: rotation.x -= delta / 10; rotation.y -= delta / 15.
      draw(-t / 10, -t / 15)
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
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
    />
  )
}
