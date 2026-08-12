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

  // Clarity used to belong here too; it now carries a repo and a Devpost
  // entry, so the linked-projects assertions below cover it instead.
  it('renders no link for Overwatch', () => {
    for (const id of ['overwatch']) {
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

  // The arrows and the NN/NN counter were removed. That took away the only
  // focusable control, so the dots — previously aria-hidden and tabIndex={-1},
  // i.e. decorative — became real labelled buttons to replace it. Without this
  // the deck would have no keyboard-reachable control at all.
  it('exposes one labelled, focusable control per project', () => {
    render(<Projects />)
    for (const project of projects) {
      const control = screen.getByRole('button', {
        name: new RegExp(`show ${project.org}`, 'i'),
      })
      expect(control).toBeInTheDocument()
      expect(control).not.toHaveAttribute('tabIndex', '-1')
    }
  })

  it('no longer renders the prev/next arrows or the position counter', () => {
    render(<Projects />)
    expect(screen.queryByRole('button', { name: /previous project/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /next project/i })).toBeNull()
    const total = String(projects.length).padStart(2, '0')
    expect(screen.queryByText(new RegExp(`01\\s*/\\s*${total}`))).toBeNull()
  })
})

describe('ProjectCard screenshots', () => {
  it('renders an image only for projects that have one', () => {
    render(<Projects />)
    const withImage = projects.filter((p) => p.image)
    const images = screen.queryAllByRole('img')
    expect(images).toHaveLength(withImage.length)
    for (const project of withImage) {
      const img = screen.getByAltText(new RegExp(`${project.org} screenshot`, 'i'))
      expect(img).toHaveAttribute('src', project.image!)
    }
  })

  it('holds the screenshot ratio on the frame, so every column aligns', () => {
    // The ratio lives on the frame, not the image: the frame is what every
    // column aligns to, and it must keep its shape whether or not an image has
    // been supplied yet. The image just fills it.
    render(<Projects />)
    const frames = document.querySelectorAll('figure')
    expect(frames).toHaveLength(projects.length)
    for (const frame of frames) {
      expect(frame.className).toMatch(/aspect-\[16\/10\]/)
    }
    for (const img of screen.queryAllByRole('img')) {
      expect(img.className).toMatch(/object-cover/)
    }
  })

  it('renders a frame for every project, including those without an image', () => {
    // Omitting the frame for an imageless project would knock the whole row out
    // of alignment, which is the failure this layout exists to avoid.
    render(<Projects />)
    expect(document.querySelectorAll('figure')).toHaveLength(projects.length)
    expect(screen.queryAllByRole('img')).toHaveLength(
      projects.filter((p) => p.image).length,
    )
  })
})
