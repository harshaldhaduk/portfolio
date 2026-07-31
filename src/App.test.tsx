import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { experience } from './data/experience'
import { projects } from './data/projects'

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

describe('App', () => {
  it('renders all four section headings', () => {
    render(<App />)
    for (const label of ['Mission Log', 'Research', 'Projects', 'Systems']) {
      expect(
        // level: 2 — the section headers are all <h2> (SectionHeader).
        // Without it, /Research/i also matches the <h3> research entry
        // title "Undergraduate Researcher", giving two matches and
        // throwing. Scoping to level 2 is what the test actually means.
        screen.getByRole('heading', { level: 2, name: new RegExp(label, 'i') }),
      ).toBeInTheDocument()
    }
  })

  it('renders every experience and project entry on the page', () => {
    render(<App />)
    for (const entry of [...experience, ...projects]) {
      // getAllByText, not getByText: IBM's org name and its timeline mark
      // are both literally "IBM" (see EntryMark), which getByText treats as
      // an ambiguous match.
      expect(
        screen.getAllByText(entry.org).length,
        `org for ${entry.id}`,
      ).toBeGreaterThan(0)
    }
  })

  it('exposes exactly one level-1 heading', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  // The placeholder this replaced was a <main>; assembling the page over it
  // silently dropped the landmark. Hero is a <header> and Footer a <footer>,
  // so without <main> the content sections belong to no region at all.
  it('exposes the content sections inside a main landmark', () => {
    render(<App />)
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    // The sections must be inside it, not siblings of it.
    expect(
      main.querySelector('section'),
      'no <section> found inside <main>',
    ).not.toBeNull()
  })

  it('renders only known-good link destinations on the assembled page', () => {
    // Allowlist rather than denylist, for the reason given in data.test.ts:
    // naming the hosts you want to exclude publishes them. Anything not
    // recognised here fails, including destinations nobody anticipated.
    const ALLOWED = [
      /^https:\/\/github\.com\/harshaldhaduk(\/|$)/,
      /^https:\/\/www\.linkedin\.com\/in\/harshaldhaduk(\/|$)/,
      /^mailto:[^@\s]+@[^@\s]+$/,
      /^\/[^/]/,
    ]
    const { container } = render(<App />)
    const hrefs = [...container.querySelectorAll('a')].map((a) =>
      a.getAttribute('href') ?? '',
    )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(
        ALLOWED.some((pattern) => pattern.test(href)),
        `unexpected link destination: ${href}`,
      ).toBe(true)
    }
  })
})
