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
  it('renders every profile link', () => {
    render(<Footer />)
    for (const link of profile.links) {
      expect(screen.getByRole('link', { name: link.label })).toHaveAttribute(
        'href',
        link.href,
      )
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
