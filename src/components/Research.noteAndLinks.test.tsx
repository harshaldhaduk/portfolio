import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * The real research entry has neither a `note` nor any `links`, so a test
 * against the real data can't prove `ResearchCard` renders them — it would
 * pass identically whether or not that code existed. Mocking the module with
 * an entry that has both is what actually proves it.
 *
 * This lives in its own file because `vi.mock` is hoisted to module scope and
 * would otherwise replace the real research data for every test in the file.
 */
vi.mock('../data/research', () => ({
  research: [
    {
      id: 'mock-lab',
      org: 'Mock Lab',
      title: 'Mock Researcher',
      dates: 'Jan 2026 — Present',
      location: 'Mockville',
      note: 'Best Poster Award, Mock Conference 2026',
      summary: ['Did a mock thing.'],
      tags: ['Mock'],
      links: [{ label: 'Analysis repo', href: 'https://github.com/example/mock-analysis' }],
    },
  ],
}))

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

const { Research } = await import('./Research')

describe('ResearchCard renders note and links when the entry has them', () => {
  it('renders the note', () => {
    render(<Research />)
    expect(
      screen.getByText('Best Poster Award, Mock Conference 2026'),
    ).toBeInTheDocument()
  })

  it('renders the link with the exact href', () => {
    render(<Research />)
    expect(screen.getByRole('link', { name: /analysis repo/i })).toHaveAttribute(
      'href',
      'https://github.com/example/mock-analysis',
    )
  })
})
