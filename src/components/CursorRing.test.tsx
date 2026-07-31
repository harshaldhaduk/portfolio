import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CursorRing } from './CursorRing'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function stubMatchMedia({
  reduced,
  finePointer,
}: {
  reduced: boolean
  finePointer: boolean
}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === REDUCED_MOTION_QUERY ? reduced : finePointer,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CursorRing', () => {
  it('does not render under reduced motion, even with a fine pointer', () => {
    stubMatchMedia({ reduced: true, finePointer: true })
    const { container } = render(<CursorRing />)
    expect(container.querySelector('[data-cursor-ring]')).toBeNull()
  })

  it('does not render when (pointer: fine) does not match', () => {
    stubMatchMedia({ reduced: false, finePointer: false })
    const { container } = render(<CursorRing />)
    expect(container.querySelector('[data-cursor-ring]')).toBeNull()
  })

  it('renders the ring when motion is allowed and the pointer is fine', () => {
    stubMatchMedia({ reduced: false, finePointer: true })
    const { container } = render(<CursorRing />)
    expect(container.querySelector('[data-cursor-ring]')).not.toBeNull()
  })

  it('is hidden from assistive technology', () => {
    stubMatchMedia({ reduced: false, finePointer: true })
    const { container } = render(<CursorRing />)
    expect(container.querySelector('[data-cursor-ring]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('removes its document listeners on unmount', () => {
    stubMatchMedia({ reduced: false, finePointer: true })
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(<CursorRing />)
    const addedEvents = addSpy.mock.calls.map((call) => call[0])
    expect(addedEvents).toEqual(
      expect.arrayContaining(['pointermove', 'pointerover', 'pointerout']),
    )
    unmount()
    const removedEvents = removeSpy.mock.calls.map((call) => call[0])
    expect(removedEvents).toEqual(
      expect.arrayContaining(['pointermove', 'pointerover', 'pointerout']),
    )
  })
})
