import { useState } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Preloader } from './Preloader'

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
  vi.useRealTimers()
})

describe('Preloader', () => {
  it('renders no overlay under reduced motion, and calls onDone immediately', () => {
    stubMatchMedia(true)
    const onDone = vi.fn()
    const { container } = render(<Preloader onDone={onDone} />)
    expect(container.querySelector('[data-preloader-bar]')).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('renders the overlay when motion is allowed', () => {
    stubMatchMedia(false)
    const { container } = render(<Preloader onDone={vi.fn()} />)
    expect(container.querySelector('[data-preloader-bar]')).not.toBeNull()
  })

  // The three pieces the timeline drives. If any selector drifts the
  // animation silently degrades to a plain fade (see the else branch in
  // Preloader), which is easy to miss by eye on a fast machine.
  it('renders every element the timeline animates', () => {
    stubMatchMedia(false)
    const { container } = render(<Preloader onDone={vi.fn()} />)
    for (const hook of ['bar', 'fill', 'burst', 'digits']) {
      expect(
        container.querySelector(`[data-preloader-${hook}]`),
        `missing [data-preloader-${hook}]`,
      ).not.toBeNull()
    }
  })

  // The whole timeline is gated on finding all six hooks; a renamed selector
  // would silently drop it to the plain-fade fallback with no other symptom.
  it('renders the counter and shows no percent sign', () => {
    stubMatchMedia(false)
    const { container } = render(<Preloader onDone={vi.fn()} />)
    // NumberFlow renders its own internal markup, so assert on presence and
    // on the digits it exposes rather than an exact textContent shape.
    expect(container.querySelector('[data-preloader-digits]')?.textContent).toMatch(/\d/)
    expect(container.textContent).not.toContain('%')
  })

  it('is hidden from assistive technology while visible', () => {
    stubMatchMedia(false)
    const { container } = render(<Preloader onDone={vi.fn()} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('calls onDone via the hard timeout even if the animation never completes', () => {
    vi.useFakeTimers()
    stubMatchMedia(false)
    const onDone = vi.fn()
    render(<Preloader onDone={onDone} />)
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone only once even if the timeout fires more than once', () => {
    vi.useFakeTimers()
    stubMatchMedia(false)
    const onDone = vi.fn()
    render(<Preloader onDone={onDone} />)
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // Exercises the exact lifecycle App.tsx relies on: a parent that renders
  // Preloader only while `loading` is true, and flips it false in onDone.
  it('is removed from the DOM once it signals done via its hard timeout', () => {
    vi.useFakeTimers()
    stubMatchMedia(false)

    function Harness() {
      const [loading, setLoading] = useState(true)
      return loading ? (
        <Preloader onDone={() => setLoading(false)} />
      ) : null
    }

    const { container } = render(<Harness />)
    expect(container.querySelector('[data-preloader-bar]')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(3500)
    })

    expect(container.querySelector('[data-preloader-bar]')).toBeNull()
  })
})
