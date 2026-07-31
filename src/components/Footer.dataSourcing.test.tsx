import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * The resume link only renders when `profile.resumeUrl` is non-null, and that
 * branch is null in the real data today — `tail.test.tsx` only ever exercises
 * the "absent" path. Mocking the module with a non-null `resumeUrl` is what
 * proves the "present" branch actually works, so the day a real resume PDF
 * lands, something already tells the owner if it broke.
 *
 * This lives in its own file because `vi.mock` is hoisted to module scope and
 * would otherwise replace the real profile for every test in the file.
 */
vi.mock('../data/profile', () => ({
  profile: {
    name: 'Placeholder Name',
    degree: 'B.S. Placeholder Studies',
    school: 'Placeholder University',
    grad: 'May 1999',
    location: 'Nowhere, XX',
    intro: ['Placeholder sentence.'],
    links: [{ label: 'Elsewhere', href: 'https://example.com/elsewhere' }],
    resumeUrl: 'https://example.com/resume.pdf',
    updated: '1999-01-01',
  },
}))

// Footer now drives a scroll reveal (useSectionReveal), which registers
// ScrollTrigger and calls window.matchMedia — jsdom has no matchMedia by
// default, so it must be stubbed here the same way every other reveal-driving
// component's tests already do.
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

const { Footer } = await import('./Footer')

describe('Footer renders the resume link when resumeUrl is set', () => {
  it('renders a Resume link pointing at profile.resumeUrl', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: /resume/i })).toHaveAttribute(
      'href',
      'https://example.com/resume.pdf',
    )
  })
})
