import type { Entry } from '../types'
import { research } from '../data/research'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { SectionHeader } from './SectionHeader'
import { EntryBody } from './EntryBody'

function ResearchCard({ entry }: { entry: Entry }) {
  return (
    <div
      data-reveal
      className="rounded-lg border border-hairline bg-panel/60 p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-medium text-ink">{entry.title}</h3>
        <span className="text-[11px] text-muted">{entry.dates}</span>
      </div>
      <p className="mt-0.5 text-xs text-dwarf/90">
        {entry.org}
        {entry.location ? (
          <span className="text-muted"> · {entry.location}</span>
        ) : null}
      </p>
      <EntryBody entry={entry} />
    </div>
  )
}

/**
 * Deliberately the last thing in Research, which is the section immediately
 * before Projects — and Projects is where the deck pins and takes over the
 * scroll. Anything placed after this point would be inside the pinned range
 * and could only be reached by scrolling the deck sideways first.
 */
const PAPER_HREF =
  'https://drive.google.com/file/d/1SmQWYCrvfDyry09uclkE93txW-To6Q4F/view?usp=sharing'

export function Research() {
  const ref = useSectionReveal<HTMLDivElement>()

  return (
    <section className="pb-20">
      <SectionHeader glyph="◉" label="Research" />
      <div ref={ref} className="space-y-4">
        {research.map((entry) => (
          <ResearchCard key={entry.id} entry={entry} />
        ))}

        {/* Inside the revealed container so it fades in with the cards rather
            than sitting there already lit while they animate. */}
        <a
          data-reveal
          data-cursor-target
          href={PAPER_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="link-sweep inline-block text-xs text-dwarf"
        >
          Read the paper ↗
        </a>
      </div>
    </section>
  )
}
