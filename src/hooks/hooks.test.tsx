import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { useSectionReveal } from './useSectionReveal'

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

function Probe() {
  const reduced = usePrefersReducedMotion()
  return <span data-testid="probe">{String(reduced)}</span>
}

describe('usePrefersReducedMotion', () => {
  it('reports true when the user asks for reduced motion', () => {
    stubMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('probe')).toHaveTextContent('true')
  })

  it('reports false otherwise', () => {
    stubMatchMedia(false)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('probe')).toHaveTextContent('false')
  })

  it('reacts when the user changes the preference mid-session', () => {
    let changeHandler: ((event: { matches: boolean }) => void) | undefined
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn((event: string, handler: typeof changeHandler) => {
          if (event === 'change') changeHandler = handler
        }),
        removeEventListener: vi.fn(),
      }),
    )
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('probe')).toHaveTextContent('false')

    expect(changeHandler).toBeDefined()
    act(() => {
      changeHandler?.({ matches: true })
    })
    expect(getByTestId('probe')).toHaveTextContent('true')
  })
})

function SectionProbe() {
  const ref = useSectionReveal<HTMLUListElement>()
  return (
    <ul ref={ref}>
      <li data-reveal data-testid="row-1" />
      <li data-reveal data-testid="row-2" />
    </ul>
  )
}

describe('useSectionReveal', () => {
  // Replaces useReveal's rootMargin test: the mechanism protecting against a
  // jump straight to the bottom of the page is no longer a huge
  // IntersectionObserver rootMargin, it is GSAP's own pass-through handling
  // of a ScrollTrigger's start/end being skipped in one scroll update (see
  // the hook's doc comment). That is a real-browser scroll-position fact,
  // not something jsdom can reproduce; it is verified with Playwright
  // instead (see e2e/a11y.spec.ts and the manual jump-to-bottom check in
  // .git/sdd/motion-report.md). What IS unit-testable here is that the
  // trigger's onEnter/onEnterBack both resolve to the same reveal, and that
  // reduced motion skips the trigger entirely and reveals synchronously.
  it('reveals every row immediately under reduced motion, with no ScrollTrigger involved', () => {
    stubMatchMedia(true)
    const batchSpy = vi.spyOn(ScrollTrigger, 'batch')
    const { getByTestId } = render(<SectionProbe />)
    expect(getByTestId('row-1')).toHaveAttribute('data-revealed', 'true')
    expect(getByTestId('row-2')).toHaveAttribute('data-revealed', 'true')
    expect(batchSpy).not.toHaveBeenCalled()
  })

  it('does not reveal rows synchronously when motion is allowed and the section is not yet in view', () => {
    stubMatchMedia(false)
    // jsdom lays out every element at (0,0), which GSAP's initial refresh
    // reads as "already past the trigger point" — placing the section far
    // below an ordinary viewport is what actually exercises "not revealed
    // yet", rather than an artifact of jsdom having no real layout.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 5000,
      bottom: 5200,
      left: 0,
      right: 100,
      width: 100,
      height: 200,
      x: 0,
      y: 5000,
      toJSON() {},
    })
    const { getByTestId } = render(<SectionProbe />)
    expect(getByTestId('row-1')).not.toHaveAttribute('data-revealed')
    expect(getByTestId('row-2')).not.toHaveAttribute('data-revealed')
  })

  // Spying on ScrollTrigger.batch itself (rather than letting the real batch
  // run) tests the hook's own contract with it — that onEnter/onEnterBack are
  // wired to reveal whichever rows the batch hands back — without reaching
  // into GSAP's internal batching/timing, which is GSAP's to test, not ours.
  it('reveals a batch of rows once ScrollTrigger.batch fires onEnter for them', () => {
    stubMatchMedia(false)
    let onEnter: ((batch: Element[]) => void) | undefined
    vi.spyOn(ScrollTrigger, 'batch').mockImplementation((_targets, vars) => {
      onEnter = vars?.onEnter as ((batch: Element[]) => void) | undefined
      return []
    })

    const { getByTestId } = render(<SectionProbe />)
    expect(onEnter).toBeDefined()
    act(() => onEnter?.([getByTestId('row-1'), getByTestId('row-2')]))

    expect(getByTestId('row-1')).toHaveAttribute('data-revealed', 'true')
    expect(getByTestId('row-2')).toHaveAttribute('data-revealed', 'true')
  })

  // onEnterBack covers the same jump in the opposite direction (Home, a hash
  // link back up the page) — asserting it resolves through the identical
  // reveal function guards against a regression that wires onEnter only.
  it('reveals a batch of rows via onEnterBack too', () => {
    stubMatchMedia(false)
    let onEnterBack: ((batch: Element[]) => void) | undefined
    vi.spyOn(ScrollTrigger, 'batch').mockImplementation((_targets, vars) => {
      onEnterBack = vars?.onEnterBack as ((batch: Element[]) => void) | undefined
      return []
    })

    const { getByTestId } = render(<SectionProbe />)
    expect(onEnterBack).toBeDefined()
    act(() => onEnterBack?.([getByTestId('row-1'), getByTestId('row-2')]))

    expect(getByTestId('row-1')).toHaveAttribute('data-revealed', 'true')
    expect(getByTestId('row-2')).toHaveAttribute('data-revealed', 'true')
  })
})
