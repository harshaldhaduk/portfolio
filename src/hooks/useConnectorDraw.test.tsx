import { useRef } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const drawableSetAttribute = vi.fn()
const createDrawable = vi.fn(() => [{ setAttribute: drawableSetAttribute }])
const animate = vi.fn()

vi.mock('animejs', () => ({ createDrawable, animate }))

const { useConnectorDraw } = await import('./useConnectorDraw')

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
  drawableSetAttribute.mockClear()
  createDrawable.mockClear()
  animate.mockClear()
})

function Probe({ revealed }: { revealed: boolean }) {
  const rowRef = useRef<HTMLLIElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  useConnectorDraw(rowRef, lineRef)
  return (
    <li ref={rowRef} data-revealed={revealed ? 'true' : undefined}>
      <svg>
        <line ref={lineRef} x1="1" y1="0" x2="1" y2="100" />
      </svg>
    </li>
  )
}

describe('useConnectorDraw', () => {
  it('initialises the line fully undrawn', () => {
    stubMatchMedia(false)
    render(<Probe revealed={false} />)
    expect(createDrawable).toHaveBeenCalledTimes(1)
  })

  it('draws instantly, with no animation, when the row is already revealed under reduced motion', () => {
    stubMatchMedia(true)
    render(<Probe revealed />)
    expect(drawableSetAttribute).toHaveBeenCalledWith('draw', '0 1')
    expect(animate).not.toHaveBeenCalled()
  })

  it('animates the draw when the row is already revealed and motion is allowed', () => {
    stubMatchMedia(false)
    render(<Probe revealed />)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0][1]).toMatchObject({ draw: ['0 0', '0 1'] })
  })

  it('does not draw yet when the row has not been revealed', () => {
    stubMatchMedia(false)
    render(<Probe revealed={false} />)
    expect(animate).not.toHaveBeenCalled()
    expect(drawableSetAttribute).not.toHaveBeenCalled()
  })

  it('draws once the row is marked revealed after mount', () => {
    stubMatchMedia(false)
    const rowRef = { current: null as HTMLLIElement | null }
    function Wrapper() {
      const lineRef = useRef<SVGLineElement>(null)
      useConnectorDraw(rowRef, lineRef)
      return (
        <li ref={(el) => { rowRef.current = el }}>
          <svg>
            <line ref={lineRef} x1="1" y1="0" x2="1" y2="100" />
          </svg>
        </li>
      )
    }
    render(<Wrapper />)
    expect(animate).not.toHaveBeenCalled()

    // Mirrors what markRevealed does: an imperative dataset mutation, not a
    // React re-render — the same mechanism useSectionReveal uses.
    rowRef.current!.dataset.revealed = 'true'

    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(animate).toHaveBeenCalledTimes(1)
        resolve()
      })
    })
  })
})
