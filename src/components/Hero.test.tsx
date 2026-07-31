import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Hero } from './Hero'
import { profile } from '../data/profile'

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

describe('Hero', () => {
  it('renders the name as the page heading', () => {
    render(<Hero />)
    expect(
      screen.getByRole('heading', { level: 1, name: /harshal dhaduk/i }),
    ).toBeInTheDocument()
  })

  it('states the degree, school and graduation', () => {
    render(<Hero />)
    // Match the exact degree string rather than /astrophysics/i, which also
    // appears in the intro copy and would make getByText throw.
    expect(screen.getByText(profile.degree)).toBeInTheDocument()
    expect(screen.getByText(/texas at austin/i)).toBeInTheDocument()
    expect(screen.getByText(/may 2028/i)).toBeInTheDocument()
  })

  it('renders every intro paragraph', () => {
    render(<Hero />)
    for (const line of profile.intro) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
  })

  it('renders every contact link', () => {
    render(<Hero />)
    for (const link of profile.links) {
      expect(screen.getByRole('link', { name: link.label })).toHaveAttribute(
        'href',
        link.href,
      )
    }
  })

  // The owner asked for no headshot. Checking only for <img> would let an
  // avatar back in as a <picture>, an inline <svg>, or a CSS background image,
  // so this guards every route a face could arrive by. The one <canvas> here is
  // the Transit diagram, which is decorative and aria-hidden.
  it('renders no portrait by any route', () => {
    const { container } = render(<Hero />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('picture')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('object')).toBeNull()
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.style.backgroundImage, el.outerHTML.slice(0, 80)).toBe('')
    }
    expect(container.innerHTML).not.toMatch(/background-image/i)
  })
})
