import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Projects } from './Projects'
import { ProjectCard } from './ProjectCard'
import { projects } from '../data/projects'

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

describe('Projects', () => {
  it('renders all five projects', () => {
    render(<Projects />)
    for (const project of projects) {
      expect(screen.getByText(project.org)).toBeInTheDocument()
    }
  })

  it('renders a repo link for projects that have one', () => {
    const lattice = projects.find((p) => p.id === 'lattice')!
    render(<ProjectCard project={lattice} />)
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      'https://github.com/harshaldhaduk/Lattice',
    )
  })

  it('renders no link for Overwatch or Clarity', () => {
    for (const id of ['overwatch', 'clarity']) {
      const project = projects.find((p) => p.id === id)!
      const { container } = render(<ProjectCard project={project} />)
      expect(container.querySelectorAll('a')).toHaveLength(0)
    }
  })

  it('renders no star counts', () => {
    const { container } = render(<Projects />)
    expect(container.textContent).not.toMatch(/★|\bstars?\b/i)
  })

  it('renders the exact repo href for each linked project', () => {
    const lattice = projects.find((p) => p.id === 'lattice')!
    const calmcampus = projects.find((p) => p.id === 'calmcampus')!
    const echotrade = projects.find((p) => p.id === 'echotrade')!

    const a = render(<ProjectCard project={lattice} />)
    expect(
      within(a.container).getByRole('link', { name: /github/i }),
    ).toHaveAttribute('href', 'https://github.com/harshaldhaduk/Lattice')

    const b = render(<ProjectCard project={calmcampus} />)
    expect(
      within(b.container).getByRole('link', { name: /github/i }),
    ).toHaveAttribute('href', 'https://github.com/harshaldhaduk/CalmCampus')

    const c = render(<ProjectCard project={echotrade} />)
    expect(
      within(c.container).getByRole('link', { name: /github/i }),
    ).toHaveAttribute('href', 'https://github.com/harshaldhaduk/EchoTrade')
  })

  it('marks each card root with data-reveal', () => {
    const lattice = projects.find((p) => p.id === 'lattice')!
    const { container } = render(<ProjectCard project={lattice} />)
    const root = container.querySelector('li')
    expect(root).toHaveAttribute('data-reveal')
  })

  // The reveal itself moved from a per-card IntersectionObserver (useReveal,
  // called by ProjectCard) to a section-scoped GSAP timeline
  // (useSectionReveal, called by Projects on its <ul>). A bare <ProjectCard>
  // now has no section wrapper driving that timeline, so proving
  // reduced-motion reveal requires rendering Projects itself.
  it('marks every card revealed under reduced motion', () => {
    const { container } = render(<Projects />)
    const cards = container.querySelectorAll('li[data-reveal]')
    expect(cards.length).toBe(projects.length)
    for (const card of cards) {
      expect(card).toHaveAttribute('data-revealed', 'true')
    }
  })

  // The grid became a card deck. The scrolling element itself must still be
  // reachable and named for a screen-reader/keyboard user — role="region" +
  // tabIndex=0 + aria-label is what makes both true — even though the visible
  // scrollbar is gone and the affordance now lives in the buttons below.
  it('exposes the card deck as a focusable, named region', () => {
    render(<Projects />)
    const region = screen.getByRole('region', { name: /scrollable deck/i })
    expect(region).toHaveAttribute('tabIndex', '0')
  })

  it('lays every project out inside the scrollable region', () => {
    render(<Projects />)
    const region = screen.getByRole('region', { name: /scrollable deck/i })
    for (const project of projects) {
      expect(within(region).getByText(project.org)).toBeInTheDocument()
    }
  })

  // Hiding the scrollbar is only defensible because the affordance moved to
  // real controls. If these stop being real, focusable buttons, the deck
  // becomes undriveable by keyboard and the hidden scrollbar becomes a bug.
  it('offers real prev/next buttons rather than decorative arrows', () => {
    render(<Projects />)
    expect(
      screen.getByRole('button', { name: /previous project/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /next project/i }),
    ).toBeInTheDocument()
  })

  it('disables Previous at the start rather than letting it no-op silently', () => {
    render(<Projects />)
    expect(screen.getByRole('button', { name: /previous project/i })).toBeDisabled()
  })

  it('shows the position out of the real project count', () => {
    render(<Projects />)
    const total = String(projects.length).padStart(2, '0')
    expect(screen.getByText(new RegExp(`01\\s*/\\s*${total}`))).toBeInTheDocument()
  })
})
