import type { Entry } from '../types'
import { TagRow } from './TagRow'
import { Expand } from './Expand'

/**
 * The shared tail of every entry — note, summary, tags, links, expandable
 * detail — rendered identically for a timeline role, a project card, and the
 * research panel. Each caller owns its own wrapper, header row, and reveal ref;
 * this owns only what they had in common.
 *
 * Note on styling: the research panel's summary list previously used slightly
 * looser spacing and higher text opacity (`mt-4 space-y-2.5`, `text-ink/85`)
 * than the other two. Unifying on the timeline/card values here was a
 * deliberate choice, not an accident of the extraction: the research section
 * earns its prominence from its bordered panel treatment, not from two pixels
 * of list spacing, and threading a className through purely to preserve that
 * difference would reintroduce the per-caller branching this component exists
 * to remove. If the looser rhythm is wanted back, it belongs on the panel in
 * Research.tsx rather than as a prop here.
 *
 * `hideDetail` lets a caller suppress the "More detail" expander without
 * touching `entry.detail` itself — LogEntry sets this for experience entries
 * per the owner's request, while the underlying interview-prep copy in
 * `data/experience.ts` stays intact for if it's wanted back. Research and
 * Projects don't pass it, so their expanders are unaffected.
 */
export function EntryBody({
  entry,
  hideDetail = false,
}: {
  entry: Entry
  hideDetail?: boolean
}) {
  return (
    <>
      {entry.note ? (
        <p className="mt-2 text-[11px] text-ember">{entry.note}</p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {entry.summary.map((line) => (
          <li key={line} className="max-w-[64ch] text-sm leading-relaxed text-ink/80">
            {line}
          </li>
        ))}
      </ul>

      <TagRow tags={entry.tags} />

      {entry.links.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-4">
          {entry.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="link-sweep text-[11px] text-muted"
              >
                {link.label}{' '}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {entry.detail && !hideDetail ? <Expand>{entry.detail}</Expand> : null}
    </>
  )
}
