import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const lenisInstances: Array<{ destroy: ReturnType<typeof vi.fn> }> = []
const lenisCtor = vi.fn()

vi.mock('lenis', () => ({
  default: class {
    destroy = vi.fn()
    raf = vi.fn()
    on = vi.fn()
    off = vi.fn()
    constructor(opts: unknown) {
      lenisCtor(opts)
      lenisInstances.push(this)
    }
  },
}))

const { useSmoothScroll } = await import('./useSmoothScroll')

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

function Probe() {
  useSmoothScroll()
  return <div data-testid="probe" />
}

afterEach(() => {
  vi.unstubAllGlobals()
  lenisInstances.length = 0
  lenisCtor.mockClear()
})

describe('useSmoothScroll', () => {
  // The whole point of the hook's reduced-motion branch: overriding native
  // scrolling is the kind of motion the preference is about, so it must not be
  // softened, it must be skipped entirely.
  it('never constructs Lenis when reduced motion is requested', () => {
    stubMatchMedia(true)
    render(<Probe />)
    expect(lenisCtor).not.toHaveBeenCalled()
    expect(lenisInstances).toHaveLength(0)
  })

  it('constructs Lenis when motion is allowed', () => {
    stubMatchMedia(false)
    render(<Probe />)
    expect(lenisCtor).toHaveBeenCalledTimes(1)
  })

  it('leaves touch scrolling native so it does not fight the platform', () => {
    stubMatchMedia(false)
    render(<Probe />)
    expect(lenisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ syncTouch: false }),
    )
  })

  it('destroys Lenis on unmount so it cannot keep hijacking scroll', () => {
    stubMatchMedia(false)
    const { unmount } = render(<Probe />)
    const instance = lenisInstances[0]
    expect(instance).toBeDefined()
    unmount()
    expect(instance.destroy).toHaveBeenCalledTimes(1)
  })
})
