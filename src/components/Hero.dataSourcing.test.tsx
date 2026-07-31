import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * `profile.intro` is the only prose on the site not transcribed from the
 * owner's resume — it is draft copy he is expected to rewrite. Asserting that
 * the rendered text equals the current `profile.intro` would pass just as well
 * against the same sentences hardcoded into the component, which would silently
 * strand his edits. Mocking the module with different content is what actually
 * proves the copy is sourced from data.
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
    intro: [
      'First sentence that exists only in this mock.',
      'Second sentence that exists only in this mock.',
    ],
    links: [{ label: 'Elsewhere', href: 'https://example.com/elsewhere' }],
    resumeUrl: null,
    updated: '1999-01-01',
  },
}))

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

const { Hero } = await import('./Hero')

describe('Hero reads its content from the profile data module', () => {
  it('renders intro copy from data rather than hardcoded prose', () => {
    render(<Hero />)
    expect(
      screen.getByText('First sentence that exists only in this mock.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Second sentence that exists only in this mock.'),
    ).toBeInTheDocument()
  })

  it('renders the name, degree and links from data too', () => {
    render(<Hero />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Placeholder Name' }),
    ).toBeInTheDocument()
    expect(screen.getByText('B.S. Placeholder Studies')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Elsewhere' })).toHaveAttribute(
      'href',
      'https://example.com/elsewhere',
    )
  })
})
