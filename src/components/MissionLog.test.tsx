import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MissionLog } from './MissionLog'
import { LogEntry } from './LogEntry'
import { experience } from '../data/experience'

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

describe('MissionLog', () => {
  it('renders every experience entry — none silently dropped', () => {
    render(<MissionLog />)
    for (const entry of experience) {
      // getAllByText, not getByText: IBM's org name and its timeline mark
      // are both literally "IBM" (see EntryMark), and getByText throws on
      // 2+ matches. Dell and Kollegio share the title "Software Engineering
      // Intern" for the same reason.
      expect(
        screen.getAllByText(entry.org).length,
        `org for ${entry.id}`,
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText(entry.title).length,
        `title for ${entry.id}`,
      ).toBeGreaterThan(0)
    }
  })

  it('renders every summary line of every entry', () => {
    render(<MissionLog />)
    for (const entry of experience) {
      for (const line of entry.summary) {
        expect(screen.getByText(line)).toBeInTheDocument()
      }
    }
  })

  it('renders no link for the Cox entry', () => {
    const cox = experience.find((e) => e.id === 'cox')!
    const { container } = render(<LogEntry entry={cox} />)
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  // The owner asked for "More detail" to disappear from experience entries
  // specifically (not Research or Projects). LogEntry now passes
  // EntryBody's `hideDetail` flag, so no entry renders a <details> here
  // regardless of whether entry.detail is set — the copy in
  // data/experience.ts is untouched, just unrendered.
  it('never shows an expander, even when the entry has detail', () => {
    const withDetail = experience.find((e) => e.id === 'dell')!
    const withoutDetail = experience.find((e) => e.id === 'pwc')!
    expect(withDetail.detail).toBeTruthy()
    const a = render(<LogEntry entry={withDetail} />)
    expect(a.container.querySelector('details')).toBeNull()
    const b = render(<LogEntry entry={withoutDetail} />)
    expect(b.container.querySelector('details')).toBeNull()
  })

  it('marks the entry root with data-reveal', () => {
    const entry = experience[0]
    const { container } = render(<LogEntry entry={entry} />)
    const root = container.querySelector('li')
    expect(root).toHaveAttribute('data-reveal')
  })

  // The reveal itself moved from a per-row IntersectionObserver (useReveal,
  // called by LogEntry) to a section-scoped GSAP timeline (useSectionReveal,
  // called by MissionLog on its <ul>). A bare <LogEntry> now has no section
  // wrapper driving that timeline, so proving reduced-motion reveal requires
  // rendering MissionLog itself rather than an isolated row.
  it('marks every entry revealed under reduced motion', () => {
    const { container } = render(<MissionLog />)
    const rows = container.querySelectorAll('li[data-reveal]')
    expect(rows.length).toBe(experience.length)
    for (const row of rows) {
      expect(row).toHaveAttribute('data-revealed', 'true')
    }
  })
})
