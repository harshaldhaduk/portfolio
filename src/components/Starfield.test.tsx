import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Starfield, generateSpherePoints, projectStar, type ProjectedStar, generateMagnitudes } from './Starfield'
import { mockCanvasContext } from '../test-utils/mockCanvas'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Starfield', () => {
  it('renders a decorative canvas hidden from assistive technology', () => {
    stubMatchMedia(false)
    const { container } = render(<Starfield />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not throw when no 2d context is available', () => {
    stubMatchMedia(false)
    expect(() => render(<Starfield />)).not.toThrow()
  })

  describe('with a mocked 2d context', () => {
    it('never starts an animation loop under reduced motion, but still draws a real frame', () => {
      const { ctx } = mockCanvasContext()
      stubMatchMedia(true)
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

      render(<Starfield />)

      expect(rafSpy).not.toHaveBeenCalled()
      // "No animation" must not be satisfiable by drawing nothing — assert
      // real draw calls land on the mocked context.
      expect(ctx.arc).toHaveBeenCalled()
      expect(ctx.fill).toHaveBeenCalled()
    })

    it('starts a requestAnimationFrame loop when motion is allowed, and cancels it on unmount', () => {
      mockCanvasContext()
      stubMatchMedia(false)
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
      const cafSpy = vi.spyOn(window, 'cancelAnimationFrame')

      const { unmount } = render(<Starfield />)

      expect(rafSpy).toHaveBeenCalled()
      unmount()
      expect(cafSpy).toHaveBeenCalled()
    })

    it('draws on the order of thousands of points in a single frame', () => {
      const { ctx } = mockCanvasContext()
      stubMatchMedia(true)

      render(<Starfield />)

      // A regression that silently drops the point count (e.g. to a
      // handful, or to the old 160-star field) must fail this.
      expect(ctx.arc.mock.calls.length).toBeGreaterThan(1000)
    })

    it('removes the resize listener it added on unmount, under reduced motion', () => {
      mockCanvasContext()
      stubMatchMedia(true)
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(<Starfield />)
      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      unmount()

      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('removes the resize listener it added on unmount, with motion allowed', () => {
      mockCanvasContext()
      stubMatchMedia(false)
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(<Starfield />)
      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      unmount()

      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    })
  })
})

describe('generateSpherePoints', () => {
  it('places every point within the sphere radius', () => {
    const radius = 1.2
    const points = generateSpherePoints(5000, radius)
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i]
      const y = points[i + 1]
      const z = points[i + 2]
      const dist = Math.sqrt(x * x + y * y + z * z)
      expect(dist).toBeLessThanOrEqual(radius + 1e-6)
    }
  })

  it('distributes points through the volume rather than clustering at the centre', () => {
    const radius = 1.2
    const count = 5000
    const points = generateSpherePoints(count, radius)
    let withinHalfRadius = 0
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i]
      const y = points[i + 1]
      const z = points[i + 2]
      const dist = Math.sqrt(x * x + y * y + z * z)
      if (dist <= radius / 2) withinHalfRadius += 1
    }
    // A uniform volume fill puts (0.5)^3 = 12.5% of points within half the
    // radius. A naive `r = radius * Math.random()` sampler clusters points
    // toward the centre, which would push this fraction well above ~30%.
    const fraction = withinHalfRadius / count
    expect(fraction).toBeGreaterThan(0.1)
    expect(fraction).toBeLessThan(0.15)
  })

  it('is deterministic across calls (stable field, no Math.random)', () => {
    const a = generateSpherePoints(500, 1.2)
    const b = generateSpherePoints(500, 1.2)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('generateMagnitudes', () => {
  it('biases toward faint stars with a few notably bright ones', () => {
    const mags = Array.from(generateMagnitudes(4000))
    const max = Math.max(...mags)
    const min = Math.min(...mags)
    const median = mags.slice().sort((a, b) => a - b)[Math.floor(mags.length / 2)]
    // A cubed uniform pushes the median far below the midpoint of the range;
    // a linear mapping would land it near the middle.
    expect(min).toBeGreaterThan(0)
    expect(max).toBeGreaterThan(median * 1.8)
    expect(median).toBeLessThan((min + max) / 2)
  })

  it('is deterministic across calls so the sky is stable across reloads', () => {
    expect(Array.from(generateMagnitudes(64))).toEqual(
      Array.from(generateMagnitudes(64)),
    )
  })
})

describe('projectStar', () => {
  function freshOut(): ProjectedStar {
    return { visible: false, sx: 0, sy: 0, radius: 0, alpha: 0 }
  }

  it('culls a point behind the camera plane instead of wrapping it', () => {
    const out = freshOut()
    // With no x/y rotation (cos=1, sin=0), a point at z = 1.1 sits behind
    // the camera at z = 1 after the static tilt (which does not move z).
    projectStar(0, 0, 1.1, 1, 0, 1, 0, 400, 400, 300, 1, out)
    expect(out.visible).toBe(false)
  })

  it('projects a visible point in front of the camera with a positive radius and alpha', () => {
    const out = freshOut()
    projectStar(0.1, 0.1, -0.5, 1, 0, 1, 0, 400, 400, 300, 1, out)
    expect(out.visible).toBe(true)
    expect(out.radius).toBeGreaterThan(0)
    expect(out.alpha).toBeGreaterThan(0)
    expect(out.alpha).toBeLessThanOrEqual(1)
  })

  it('makes a brighter star larger and more opaque at the same distance', () => {
    // The whole reason magnitude exists: without it every star at a given
    // depth is identical and the field reads as uniform noise.
    const dim = freshOut()
    const bright = freshOut()
    projectStar(0.1, 0.1, -0.5, 1, 0, 1, 0, 400, 400, 300, 0.6, dim)
    projectStar(0.1, 0.1, -0.5, 1, 0, 1, 0, 400, 400, 300, 2.4, bright)
    expect(bright.radius).toBeGreaterThan(dim.radius)
    expect(bright.alpha).toBeGreaterThan(dim.alpha)
  })

  it('scales size and alpha inversely with distance from the camera (attenuation)', () => {
    const near = freshOut()
    const far = freshOut()
    projectStar(0.1, 0.1, -0.2, 1, 0, 1, 0, 400, 400, 300, 1, near)
    projectStar(0.1, 0.1, -1.1, 1, 0, 1, 0, 400, 400, 300, 1, far)
    expect(near.radius).toBeGreaterThanOrEqual(far.radius)
    expect(near.alpha).toBeGreaterThanOrEqual(far.alpha)
  })
})
