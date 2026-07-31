import { useRef } from 'react'
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

const { useHorizontalScroll } = await import('./useHorizontalScroll')

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
  const ref = useRef<HTMLDivElement>(null)
  useHorizontalScroll(ref)
  return (
    <div ref={ref}>
      <ul>
        <li>card</li>
      </ul>
    </div>
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  lenisInstances.length = 0
  lenisCtor.mockClear()
})

describe('useHorizontalScroll', () => {
  it('never constructs a scoped Lenis instance under reduced motion', () => {
    stubMatchMedia(true)
    render(<Probe />)
    expect(lenisCtor).not.toHaveBeenCalled()
    expect(lenisInstances).toHaveLength(0)
  })

  it('constructs a horizontally-oriented Lenis instance when motion is allowed', () => {
    stubMatchMedia(false)
    render(<Probe />)
    expect(lenisCtor).toHaveBeenCalledTimes(1)
    expect(lenisCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        orientation: 'horizontal',
        gestureOrientation: 'horizontal',
        syncTouch: false,
      }),
    )
  })

  it('destroys the scoped instance on unmount', () => {
    stubMatchMedia(false)
    const { unmount } = render(<Probe />)
    const instance = lenisInstances[0]
    expect(instance).toBeDefined()
    unmount()
    expect(instance.destroy).toHaveBeenCalledTimes(1)
  })
})
