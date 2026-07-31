import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PERIOD_MS, Transit, fluxAt, fluxAtPhase, photometricNoise, fluxAtTime } from './Transit'
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

/** jsdom never lays out canvases, so clientWidth/clientHeight are 0 unless
 * stubbed. Returns a restore function so callers can un-stub between runs
 * of a width sweep within a single test. */
function stubCanvasSize(width: number, height: number) {
  const widthSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(width)
  const heightSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(height)
  return () => {
    widthSpy.mockRestore()
    heightSpy.mockRestore()
  }
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

    it('reduced motion: static body stays mid-ingress across widths', () => {
      // Regression guard: the static frame's body position must be derived
      // from geometry (starR/travel), not a width-independent constant — a
      // hardcoded phase only lands inside the ingress zone at narrow widths
      // and leaves the body clear of the disc (flux === 1) everywhere else.
      const widths = [320, 448, 768, 1024]

      for (const width of widths) {
        stubReducedMotion(true)
        stubRaf()
        const { ctx, restore: restoreCtx } = mockCanvasContext()
        const restoreSize = stubCanvasSize(width, 280)

        const { unmount } = render(<Transit />)

        // arc call order per frame(): drawStar's glow, drawStar's disc
        // (starX, starY, starR), then drawBody (bodyX, starY, bodyR).
        const [starX, , starR] = ctx.arc.mock.calls[1]
        const [bodyX, , bodyR] = ctx.arc.mock.calls[2]
        const depth = (bodyR * bodyR) / (starR * starR)

        const flux = fluxAt(bodyX, starX, starR, bodyR)
        expect(flux).not.toBe(1)
        expect(flux).toBeCloseTo(1 - depth / 2, 10)

        unmount()
        restoreCtx()
        restoreSize()
      }
    })

    it('flips draw order between the back pass and the front pass', () => {
      // The animation loop's rAF is stubbed, so it never recurses on its
      // own; grabbing the captured tick callback and invoking it directly
      // lets us drive the loop to an exact orbital phase without waiting.
      stubReducedMotion(false)
      const { ctx, restore: restoreCtx } = mockCanvasContext()
      const { raf } = stubRaf()
      const restoreSize = stubCanvasSize(768, 280)

      const { unmount } = render(<Transit />)
      const tick = raf.mock.calls[0][0] as (now: number) => void

      // First call establishes start=0 -> phase 0 -> occultation (back
      // pass): the star must be painted after (on top of) the body.
      tick(0)
      const backOrder = ctx.arc.mock.invocationCallOrder.slice()
      const backCallsAtBody = ctx.arc.mock.calls.length
      expect(backCallsAtBody).toBeGreaterThanOrEqual(3)
      // arc call 0: body disc. arc calls 1,2: star glow + disc.
      expect(backOrder[0]).toBeLessThan(backOrder[1])
      expect(backOrder[0]).toBeLessThan(backOrder[2])

      ctx.arc.mockClear()

      // Half a period later -> phase 0.5 -> transit (front pass): the
      // star must be painted before (underneath) the body.
      tick(PERIOD_MS / 2)
      const frontOrder = ctx.arc.mock.invocationCallOrder.slice()
      expect(frontOrder.length).toBeGreaterThanOrEqual(3)
      // arc calls 0,1: star glow + disc. arc call 2: body disc.
      expect(frontOrder[2]).toBeGreaterThan(frontOrder[0])
      expect(frontOrder[2]).toBeGreaterThan(frontOrder[1])

      unmount()
      restoreCtx()
      restoreSize()
    })
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
