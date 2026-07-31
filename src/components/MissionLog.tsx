import { experience } from '../data/experience'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { SectionHeader } from './SectionHeader'
import { LogEntry } from './LogEntry'

export function MissionLog() {
  const ref = useSectionReveal<HTMLUListElement>()

  return (
    <section className="pb-20">
      <SectionHeader glyph="⟟" label="Mission Log" />
      <ul ref={ref}>
        {experience.map((entry) => (
          <LogEntry key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}
