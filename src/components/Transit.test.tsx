import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ORBIT_RADIUS,
  PERIOD_MS,
  PLANET_RADIUS,
  STAR_RADIUS,
  Transit,
  fluxAt,
  fluxAtPhase,
  photometricNoise,
  fluxAtTime,
  REST_ELEVATION,
  orbitAngle,
  projectedSeparation,
} from './Transit'
import { mockCanvasContext } from '../test-utils/mockCanvas'

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

/** Stub rAF/cAF so the continuous animation loop never actually recurses in
 * jsdom — we only need to assert it was scheduled/cancelled, not run it. */
function stubRaf() {
  const raf = vi.fn().mockReturnValue(1)
  const caf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  return { raf, caf }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Transit', () => {
  it('renders a decorative canvas hidden from assistive technology', () => {
    stubReducedMotion(false)
    const { container } = render(<Transit />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not throw with no 2d context, in either motion mode', () => {
    stubReducedMotion(false)
    expect(() => render(<Transit />)).not.toThrow()
    stubReducedMotion(true)
    expect(() => render(<Transit />)).not.toThrow()
  })

  describe('with a mocked 2d context', () => {
    it('reduced motion: never starts an animation frame loop', () => {
      mockCanvasContext()
      stubReducedMotion(true)
      const { raf } = stubRaf()

      render(<Transit />)

      expect(raf).not.toHaveBeenCalled()
    })

    it('reduced motion: still draws a real static frame', () => {
      const { ctx } = mockCanvasContext()
      stubReducedMotion(true)
      stubRaf()

      render(<Transit />)

      expect(ctx.arc).toHaveBeenCalled()
      expect(ctx.fill).toHaveBeenCalled()
      expect(ctx.lineTo).toHaveBeenCalled()
      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('motion allowed: starts an animation frame loop', () => {
      mockCanvasContext()
      stubReducedMotion(false)
      const { raf } = stubRaf()

      render(<Transit />)

      expect(raf).toHaveBeenCalled()
    })

    it('motion allowed: cancels the animation frame on unmount', () => {
      mockCanvasContext()
      stubReducedMotion(false)
      const { raf, caf } = stubRaf()

      const { unmount } = render(<Transit />)
      unmount()

      expect(raf).toHaveBeenCalled()
      expect(caf).toHaveBeenCalled()
    })

    // The star, the planet and their draw order used to be asserted here by
    // inspecting 2D arc() calls. That geometry now lives in the WebGL scene
    // (OrbitScene), where occlusion is the depth buffer's job rather than
    // paint order's, and jsdom has no WebGL to inspect. What actually needed
    // protecting was the physics those assertions stood in for — that the
    // planet really does cross the disc — which is now covered directly and
    // far more precisely by the pure-function suites below.
  })

  describe('fluxAt (light-curve/transit synchronisation)', () => {
    const starX = 100
    const starR = 30
    const bodyR = 30 * 0.28

    it('is at its minimum when the body is centred on the star', () => {
      const depth = (bodyR * bodyR) / (starR * starR)
      expect(fluxAt(starX, starX, starR, bodyR)).toBeCloseTo(1 - depth, 10)
    })

    it('is 1 (unobscured) when the body is clear of the disc', () => {
      expect(fluxAt(starX + starR + bodyR + 5, starX, starR, bodyR)).toBe(1)
      expect(fluxAt(starX - starR - bodyR - 5, starX, starR, bodyR)).toBe(1)
    })

    it('is strictly between minimum and 1 during ingress, on both sides', () => {
      const depth = (bodyR * bodyR) / (starR * starR)
      const min = 1 - depth
      // Boundaries of the ramp (starR - bodyR, starR + bodyR): full depth at
      // the inner edge, fully clear at the outer edge.
      expect(fluxAt(starX + starR - bodyR, starX, starR, bodyR)).toBeCloseTo(
        min,
        10,
      )
      expect(fluxAt(starX + starR + bodyR, starX, starR, bodyR)).toBe(1)
      expect(fluxAt(starX - (starR - bodyR), starX, starR, bodyR)).toBeCloseTo(
        min,
        10,
      )
      expect(fluxAt(starX - (starR + bodyR), starX, starR, bodyR)).toBe(1)

      // Off-centre samples on each side: the deeper-overlap point (closer to
      // the star) must be strictly darker than the shallower one. This pins
      // the ramp's direction — an inverted ramp would flip the inequality.
      const rightDeep = fluxAt(starX + starR - bodyR / 2, starX, starR, bodyR)
      const rightShallow = fluxAt(
        starX + starR + bodyR / 2,
        starX,
        starR,
        bodyR,
      )
      expect(rightDeep).toBeLessThan(rightShallow)
      expect(rightDeep).toBeGreaterThan(min)
      expect(rightShallow).toBeLessThan(1)

      const leftDeep = fluxAt(starX - (starR - bodyR / 2), starX, starR, bodyR)
      const leftShallow = fluxAt(
        starX - (starR + bodyR / 2),
        starX,
        starR,
        bodyR,
      )
      expect(leftDeep).toBeLessThan(leftShallow)
      expect(leftDeep).toBeGreaterThan(min)
      expect(leftShallow).toBeLessThan(1)
    })
  })

  describe('fluxAtPhase (orbital physics)', () => {
    // Geometry for a body on a circular orbit, seen nearly edge-on: phase
    // 0.5 is inferior conjunction (front pass, transit); phase 0 is
    // superior conjunction (back pass, occultation). Both are centred, so
    // horizontal distance to the star is exactly zero at each.
    const starX = 100
    const starR = 30
    const bodyR = 30 * 0.28
    const travel = 400

    it('dips on the front pass and does not on the back pass', () => {
      const depth = (bodyR * bodyR) / (starR * starR)
      const front = fluxAtPhase(0.5, starX, starR, bodyR, travel)
      const back = fluxAtPhase(0, starX, starR, bodyR, travel)

      expect(front).toBeCloseTo(1 - depth, 10)
      expect(back).toBe(1)
    })

    it("the full-period curve has a genuine dip: min well below 1, max exactly 1", () => {
      const samples = 200
      const curve = Array.from({ length: samples }, (_, i) =>
        fluxAtPhase(i / (samples - 1), starX, starR, bodyR, travel),
      )
      const depth = (bodyR * bodyR) / (starR * starR)

      expect(Math.max(...curve)).toBe(1)
      // The true minimum is 1 - depth (~0.9216 here); "meaningfully below
      // 1" is checked against a fixed threshold well clear of floating
      // point noise around 1, not against the depth itself.
      expect(Math.min(...curve)).toBeLessThan(0.95)
      expect(Math.min(...curve)).toBeCloseTo(1 - depth, 5)
    })
  })
})

/**
 * The behaviour that makes the orbit worth dragging: rotating away from
 * edge-on has to genuinely stop the planet occulting the star, so the light
 * curve flattens because of physics rather than because of a cosmetic fade.
 */
describe('viewing elevation (rotating the orbit)', () => {
  const a = ORBIT_RADIUS
  const starR = STAR_RADIUS
  const bodyR = PLANET_RADIUS
  const travel = a * 2
  /** Above this, the planet's projected path clears the disc entirely and no
   *  transit of any depth is geometrically possible. */
  const grazingElevation = Math.asin((starR + bodyR) / a)

  const minFluxOverOrbit = (elevation: number) => {
    let min = 1
    for (let i = 0; i < 720; i += 1) {
      min = Math.min(min, fluxAtPhase(i / 720, 0, starR, bodyR, travel, elevation))
    }
    return min
  }

  it('edge-on reduces exactly to the flat horizontal case', () => {
    for (const phase of [0, 0.17, 0.33, 0.5, 0.72, 0.95]) {
      expect(projectedSeparation(phase, a, 0)).toBeCloseTo(
        Math.abs(a * Math.cos(orbitAngle(phase))),
        10,
      )
    }
  })

  it('still transits at the resting elevation the scene loads at', () => {
    // Guards the default camera angle: pick it too steep and the hero would
    // load with a light curve that never dips, which is the whole feature.
    expect(REST_ELEVATION).toBeLessThan(grazingElevation)
    expect(minFluxOverOrbit(REST_ELEVATION)).toBeLessThan(1)
  })

  /** Below this the planet's disc still falls entirely within the star's, so
   *  the dip is at full depth however the orbit is rotated. */
  const fullyInsideElevation = Math.asin((starR - bodyR) / a)

  it('never deepens the dip as the orbit rotates away from edge-on', () => {
    const depths = [0, 0.05, 0.1, 0.15, 0.2, 0.25].map((e) => 1 - minFluxOverOrbit(e))
    for (let i = 1; i < depths.length; i += 1) {
      expect(depths[i]).toBeLessThanOrEqual(depths[i - 1] + 1e-12)
    }
  })

  it('holds full depth while the planet is still entirely inside the disc', () => {
    // Not a plateau bug: a fully-contained planet blocks the same area of
    // photosphere wherever it crosses, so the depth genuinely cannot change
    // until its disc starts hanging over the limb.
    const full = (bodyR * bodyR) / (starR * starR)
    for (const e of [0, fullyInsideElevation * 0.5, fullyInsideElevation * 0.95]) {
      expect(1 - minFluxOverOrbit(e)).toBeCloseTo(full, 12)
    }
  })

  it('shrinks the dip through the grazing band, before it disappears', () => {
    // Derived from the geometry rather than hardcoded, so retuning the scene's
    // radii cannot silently move the band out from under this test.
    const band = [0.2, 0.4, 0.6, 0.8].map(
      (t) => fullyInsideElevation + t * (grazingElevation - fullyInsideElevation),
    )
    for (const e of band) {
      expect(e).toBeGreaterThan(fullyInsideElevation)
      expect(e).toBeLessThan(grazingElevation)
    }
    const depths = band.map((e) => 1 - minFluxOverOrbit(e))
    for (let i = 1; i < depths.length; i += 1) {
      expect(depths[i]).toBeLessThan(depths[i - 1])
    }
    expect(depths[depths.length - 1]).toBeGreaterThan(0)
  })

  it('has no dip at all once rotated past the grazing angle', () => {
    expect(minFluxOverOrbit(grazingElevation + 0.05)).toBe(1)
  })
})

/**
 * Azimuth is the other half of the viewpoint, and it does a different job to
 * elevation: swinging the camera horizontally moves *when* the planet lines up
 * with the star, without changing how deep that alignment goes. Regression
 * cover for the light curve having originally consumed elevation only, which
 * pinned conjunction to one fixed bearing.
 */
describe('viewing azimuth (swinging the camera horizontally)', () => {
  const a = ORBIT_RADIUS
  const starR = STAR_RADIUS
  const bodyR = PLANET_RADIUS
  const travel = a * 2

  /** Phase of deepest occultation, i.e. where the transit actually happens. */
  const transitPhase = (azimuth: number) => {
    let best = 0
    let min = Infinity
    for (let i = 0; i < 2000; i += 1) {
      const phase = i / 2000
      const f = fluxAtPhase(phase, 0, starR, bodyR, travel, 0, azimuth)
      if (f < min) {
        min = f
        best = phase
      }
    }
    return { phase: best, flux: min }
  }

  it('moves the transit to a different phase as the camera swings round', () => {
    const head0n = transitPhase(0)
    const quarter = transitPhase(Math.PI / 2)
    expect(Math.abs(quarter.phase - head0n.phase)).toBeGreaterThan(0.2)
  })

  it('keeps the transit exactly as deep, wherever it moves to', () => {
    // A circular orbit is the same distance out all the way round, so changing
    // which side you watch it from cannot change how much light is blocked.
    const depths = [0, 0.7, Math.PI / 2, 2.4, Math.PI].map((az) => transitPhase(az).flux)
    for (const f of depths) {
      expect(f).toBeCloseTo(depths[0], 6)
      expect(f).toBeLessThan(1)
    }
  })

  it('comes back round to where it started after a full turn', () => {
    for (const phase of [0.1, 0.35, 0.6, 0.85]) {
      expect(projectedSeparation(phase, a, 0.08, 0.9)).toBeCloseTo(
        projectedSeparation(phase, a, 0.08, 0.9 + Math.PI * 2),
        10,
      )
    }
  })
})

describe('photometric variability', () => {
  it('stays bounded and is genuinely varying, not constant', () => {
    const samples = Array.from({ length: 500 }, (_, i) => photometricNoise(i * 37))
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(new Set(samples.map((v) => v.toFixed(4))).size).toBeGreaterThan(400)
  })

  it('is deterministic in time, so the trace is frame-rate independent', () => {
    // The same instant must yield the same value no matter when it is asked
    // for; that is what lets the chart scroll without a frame-indexed buffer.
    expect(photometricNoise(1234.5)).toBe(photometricNoise(1234.5))
  })

  it('never leaves the trace flat between transits', () => {
    const starX = 500
    const starR = 30
    const bodyR = starR * 0.28
    const travel = 900
    // Sample a stretch of the orbit well away from the transit and confirm the
    // signal moves. A flat line here was the original complaint.
    const away = Array.from({ length: 60 }, (_, i) =>
      fluxAtTime(PERIOD_MS * 0.02 + i * 25, starX, starR, bodyR, travel),
    )
    const spread = Math.max(...away) - Math.min(...away)
    expect(spread).toBeGreaterThan(0)
  })

  it('keeps the dip clearly deeper than the variability around it', () => {
    // The point of the whole change: the transit has to be findable INSIDE the
    // noise. If the wobble ever rivals the dip, the diagram stops reading.
    const starX = 500
    const starR = 30
    const bodyR = starR * 0.28
    const travel = 900
    const depth = (bodyR * bodyR) / (starR * starR)

    const all = Array.from({ length: 2000 }, (_, i) =>
      fluxAtTime((i * PERIOD_MS) / 2000, starX, starR, bodyR, travel),
    )
    const minFlux = Math.min(...all)

    // Peak-to-peak variability, measured on the noise alone.
    const noiseOnly = Array.from({ length: 2000 }, (_, i) =>
      photometricNoise((i * PERIOD_MS) / 2000),
    )
    const noisePP =
      (Math.max(...noiseOnly) - Math.min(...noiseOnly)) * depth * 0.17

    const dipBelowBaseline = 1 - minFlux
    expect(dipBelowBaseline).toBeGreaterThan(noisePP * 2)
  })
})
