import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionHeader } from './SectionHeader'
import { TagRow } from './TagRow'
import { Expand } from './Expand'

describe('SectionHeader', () => {
  it('renders the label as a heading', () => {
    render(<SectionHeader glyph="⟟" label="Mission Log" />)
    expect(
      screen.getByRole('heading', { name: /mission log/i }),
    ).toBeInTheDocument()
  })
})

describe('TagRow', () => {
  it('renders every tag', () => {
    render(<TagRow tags={['Python', 'Snowflake', 'Airflow']} />)
    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Snowflake')).toBeInTheDocument()
    expect(screen.getByText('Airflow')).toBeInTheDocument()
  })

  it('renders nothing when there are no tags', () => {
    const { container } = render(<TagRow tags={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Expand', () => {
  it('hides its detail until opened', () => {
    render(<Expand>The MQTT backend aggregated telemetry streams.</Expand>)
    const details = screen.getByText(/more detail/i).closest('details')
    expect(details).not.toHaveAttribute('open')
  })

  it('exposes the detail text for assistive technology', () => {
    render(<Expand>The MQTT backend aggregated telemetry streams.</Expand>)
    expect(screen.getByText(/aggregated telemetry streams/i)).toBeInTheDocument()
  })
})
