import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EntryMark } from './EntryMark'
import type { Entry } from '../types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'test',
    org: 'Test Org',
    title: 'Test Title',
    dates: '2026',
    summary: ['A line.'],
    tags: [],
    links: [],
    ...overrides,
  }
}

describe('EntryMark', () => {
  it('renders the mark text when no logo is set', () => {
    const { container, getByText } = render(
      <EntryMark entry={makeEntry({ mark: 'PwC' })} />,
    )
    expect(getByText('PwC')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders an img when logo is set', () => {
    const { container } = render(
      <EntryMark entry={makeEntry({ mark: 'IBM', logo: '/logos/ibm.svg' })} />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', '/logos/ibm.svg')
  })

  // The logo image is decorative — entry.org is rendered as visible text
  // elsewhere in LogEntry, so the image would otherwise duplicate an
  // accessible name a screen reader has already announced for this entry.
  it('marks the logo image decorative rather than giving it an accessible name', () => {
    const { container } = render(
      <EntryMark entry={makeEntry({ mark: 'IBM', logo: '/logos/ibm.svg' })} />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('alt', '')
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('falls back to the mark when the logo image fails to load', () => {
    const { container, getByText } = render(
      <EntryMark entry={makeEntry({ mark: 'Dell', logo: '/logos/dell.svg' })} />,
    )
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(getByText('Dell')).toBeInTheDocument()
  })
})
