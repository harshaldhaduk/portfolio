import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Systems } from './Systems'
import { Footer } from './Footer'
import { skills } from '../data/skills'
import { profile } from '../data/profile'

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

describe('Systems', () => {
  it('renders every group and every skill', () => {
    render(<Systems />)
    for (const group of skills) {
      expect(screen.getByText(group.kind)).toBeInTheDocument()
      for (const item of group.items) {
        expect(screen.getAllByText(item).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('Footer', () => {
  // The contact links live in the hero only. Repeating them down here put the
  // same three destinations in front of the visitor twice, so the footer now
  // deliberately carries none of them — asserted rather than left implicit, so
  // reinstating them is a conscious change and not an accident.
  it('does not repeat the hero contact links', () => {
    render(<Footer />)
    for (const link of profile.links) {
      expect(screen.queryByRole('link', { name: link.label })).toBeNull()
    }
  })

  it('omits the resume link while no PDF exists', () => {
    render(<Footer />)
    expect(screen.queryByRole('link', { name: /resume/i })).toBeNull()
  })

  it('shows the updated date', () => {
    render(<Footer />)
    expect(
      screen.getByText(`updated ${profile.updated}`),
    ).toBeInTheDocument()
  })
})
