import { skills } from '../data/skills'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { SectionHeader } from './SectionHeader'
import { TagRow } from './TagRow'

export function Systems() {
  const ref = useSectionReveal<HTMLDListElement>()

  return (
    <section className="pb-20">
      <SectionHeader glyph="⌗" label="Systems" />
      <dl ref={ref} className="space-y-5">
        {skills.map((group) => (
          <div key={group.kind} data-reveal>
            <dt className="text-[11px] tracking-wider text-muted uppercase">
              {group.kind}
            </dt>
            <dd>
              <TagRow tags={group.items} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
