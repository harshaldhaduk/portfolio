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
    expect(container.querySelector('[data-preloader-ring]')).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('renders the overlay when motion is allowed', () => {
    stubMatchMedia(false)
    const { container } = render(<Preloader onDone={vi.fn()} />)
    expect(container.querySelector('[data-preloader-ring]')).not.toBeNull()
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
      vi.advanceTimersByTime(3000)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone only once even if the timeout fires more than once', () => {
    vi.useFakeTimers()
    stubMatchMedia(false)
    const onDone = vi.fn()
    render(<Preloader onDone={onDone} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => {
      vi.advanceTimersByTime(3000)
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
    expect(container.querySelector('[data-preloader-ring]')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(container.querySelector('[data-preloader-ring]')).toBeNull()
  })
})
