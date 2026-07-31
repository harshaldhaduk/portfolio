import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Research } from './Research'
import { research } from '../data/research'

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
)

describe('Research', () => {
  it('renders the lab and every summary line', () => {
    render(<Research />)
    const entry = research[0]
    expect(screen.getByText(entry.org)).toBeInTheDocument()
    for (const line of entry.summary) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
  })

  it('surfaces the exoplanet result the hero canvas illustrates', () => {
    render(<Research />)
    expect(screen.getByText(/2 exoplanet candidates/i)).toBeInTheDocument()
  })

  it('marks the card root with data-reveal, and revealed under reduced motion', () => {
    const { container } = render(<Research />)
    const root = container.querySelector('[data-reveal]')
    expect(root).toHaveAttribute('data-reveal')
    expect(root).toHaveAttribute('data-revealed', 'true')
  })
})
